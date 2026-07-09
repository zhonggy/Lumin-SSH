package ai

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"luminssh-go/internal/mcpserver"
)

type aiToolRestoreFileSnapshot struct {
	Path           string `json:"path"`
	BeforeContent  string `json:"beforeContent"`
	AppliedContent string `json:"appliedContent"`
	ExistedBefore  bool   `json:"existedBefore"`
	ExistsAfter    bool   `json:"existsAfter"`
}

type aiToolRestoreState struct {
	Version        int                         `json:"version"`
	ReviewID       string                      `json:"reviewId"`
	RequestID      string                      `json:"requestId,omitempty"`
	ConversationID string                      `json:"conversationId"`
	SessionID      string                      `json:"sessionId"`
	ToolName       string                      `json:"toolName"`
	Summary        string                      `json:"summary"`
	ArtifactPath   string                      `json:"artifactPath,omitempty"`
	PatchPath      string                      `json:"patchPath,omitempty"`
	CreatedAt      int64                       `json:"createdAt"`
	Files          []aiToolRestoreFileSnapshot `json:"files"`
}

func isAIRestoreSupportedTool(tool aiParsedToolUse) bool {
	switch strings.TrimSpace(tool.Name) {
	case "apply_diff", "write_to_file", "search_replace", "edit_file", "apply_patch":
		return true
	default:
		return false
	}
}

func isAIRestoreTargetMissing(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, os.ErrNotExist) {
		return true
	}
	lowerError := strings.ToLower(err.Error())
	return strings.Contains(lowerError, "no such file") || strings.Contains(lowerError, "not exist")
}

func attachAIRestoreArtifactRef(message map[string]interface{}, artifactPath string) map[string]interface{} {
	trimmedArtifactPath := strings.TrimSpace(artifactPath)
	if message == nil || trimmedArtifactPath == "" {
		return message
	}
	existingExtra, _ := message["extra"].(map[string]interface{})
	if existingExtra == nil {
		existingExtra = map[string]interface{}{}
	}
	existingExtra["restoreArtifactPath"] = trimmedArtifactPath
	message["extra"] = existingExtra
	return message
}

func attachAICopyContent(message map[string]interface{}, copyContent string) map[string]interface{} {
	trimmedCopyContent := strings.TrimSpace(copyContent)
	if message == nil || trimmedCopyContent == "" {
		return message
	}
	existingExtra, _ := message["extra"].(map[string]interface{})
	if existingExtra == nil {
		existingExtra = map[string]interface{}{}
	}
	existingExtra["copyContent"] = trimmedCopyContent
	message["extra"] = existingExtra
	return message
}

func (a *App) readAIRestoreTargetState(ctx context.Context, sessionID string, remotePath string) (string, bool, error) {
	if a == nil || a.sshManager == nil {
		return "", false, fmt.Errorf("ssh manager unavailable")
	}
	sftpClient, err := a.sshManager.getSFTPClient(sessionID)
	if err != nil {
		return "", false, err
	}
	if _, err := sftpClient.Stat(remotePath); err != nil {
		if isAIRestoreTargetMissing(err) {
			return "", false, nil
		}
		return "", false, err
	}
	content, err := a.sshManager.ReadFileContext(ctx, sessionID, remotePath)
	if err != nil {
		return "", false, err
	}
	return content, true, nil
}

func buildAIRestoreReviewPathLabel(files []aiToolRestoreFileSnapshot) string {
	if len(files) == 0 {
		return ""
	}
	if len(files) == 1 {
		return files[0].Path
	}
	return fmt.Sprintf("%d 个文件", len(files))
}

func (a *App) buildAIRestoreReviewPayload(state *aiToolRestoreState) map[string]interface{} {
	blocks := make([]map[string]interface{}, 0, len(state.Files))
	for index, file := range state.Files {
		label := file.Path
		if strings.TrimSpace(label) == "" {
			label = fmt.Sprintf("文件 #%d", index+1)
		}
		blocks = append(blocks, map[string]interface{}{
			"index":  index,
			"label":  label,
			"before": file.AppliedContent,
			"after":  file.BeforeContent,
		})
	}
	return map[string]interface{}{
		"reviewId":           state.ReviewID,
		"title":              "变更审阅台",
		"requestId":          state.RequestID,
		"toolMessageId":      state.ReviewID,
		"sessionId":          state.SessionID,
		"path":               buildAIRestoreReviewPathLabel(state.Files),
		"toolName":           state.ToolName,
		"summary":            state.Summary,
		"rawDiff":            "",
		"blocks":             blocks,
		"mode":               "preview_restore",
		"restoreArtifactPath": state.ArtifactPath,
	}
}

func (a *App) verifyAIRestoreState(ctx context.Context, state *aiToolRestoreState) error {
	if state == nil || len(state.Files) == 0 {
		return fmt.Errorf("当前状态不支持还原")
	}
	for _, file := range state.Files {
		currentContent, exists, err := a.readAIRestoreTargetState(ctx, state.SessionID, file.Path)
		if err != nil {
			return err
		}
		if exists != file.ExistsAfter {
			return fmt.Errorf("当前状态不支持还原")
		}
		if exists && currentContent != file.AppliedContent {
			return fmt.Errorf("当前状态不支持还原")
		}
	}
	return nil
}

func (a *App) buildApplyDiffRestoreState(tool aiParsedToolUse, payload AIChatRequestPayload, reviewID string) (*aiToolRestoreState, error) {
	sessionID := strings.TrimSpace(payload.SessionID)
	if sessionID == "" {
		return nil, fmt.Errorf("apply_diff 缺少 session_id")
	}
	remotePath := strings.TrimSpace(tool.Params["path"])
	if remotePath == "" {
		return nil, fmt.Errorf("apply_diff 缺少 path")
	}
	diffPayload := tool.Params["diff"]
	if strings.TrimSpace(diffPayload) == "" {
		return nil, fmt.Errorf("apply_diff 缺少 diff")
	}
	fileProvider := mcpFileProvider{app: a}
	originalContent, err := fileProvider.ReadTextFileContext(context.Background(), sessionID, remotePath)
	if err != nil {
		return nil, err
	}
	preview, err := mcpserver.BuildApplyDiffPreview(remotePath, originalContent, diffPayload)
	if err != nil {
		return nil, err
	}
	if preview.Failure != nil {
		return nil, errors.New(formatChangeReviewFailure(preview.Failure, preview.FailureBlockStartLine))
	}
	return &aiToolRestoreState{
		Version:   1,
		ReviewID:  reviewID,
		SessionID: sessionID,
		ToolName:  strings.TrimSpace(tool.Name),
		Summary:   summarizeParsedToolUse(tool),
		CreatedAt: time.Now().UnixMilli(),
		Files: []aiToolRestoreFileSnapshot{
			{
				Path:           remotePath,
				BeforeContent:  preview.OriginalContent,
				AppliedContent: preview.PreviewContent,
				ExistedBefore:  true,
				ExistsAfter:    true,
			},
		},
	}, nil
}

func (a *App) buildWriteToFileRestoreState(tool aiParsedToolUse, payload AIChatRequestPayload, reviewID string) (*aiToolRestoreState, error) {
	sessionID := strings.TrimSpace(payload.SessionID)
	if sessionID == "" {
		return nil, fmt.Errorf("write_to_file 缺少 session_id")
	}
	remotePath := strings.TrimSpace(tool.Params["path"])
	if remotePath == "" {
		return nil, fmt.Errorf("write_to_file 缺少 path")
	}
	finalContent := tool.Params["content"]
	originalContent, existedBefore, err := a.readAIRestoreTargetState(context.Background(), sessionID, remotePath)
	if err != nil {
		return nil, err
	}
	return &aiToolRestoreState{
		Version:   1,
		ReviewID:  reviewID,
		SessionID: sessionID,
		ToolName:  strings.TrimSpace(tool.Name),
		Summary:   summarizeParsedToolUse(tool),
		CreatedAt: time.Now().UnixMilli(),
		Files: []aiToolRestoreFileSnapshot{
			{
				Path:           remotePath,
				BeforeContent:  originalContent,
				AppliedContent: finalContent,
				ExistedBefore:  existedBefore,
				ExistsAfter:    true,
			},
		},
	}, nil
}

func (a *App) buildSearchReplaceRestoreState(tool aiParsedToolUse, payload AIChatRequestPayload, reviewID string) (*aiToolRestoreState, error) {
	sessionID := strings.TrimSpace(payload.SessionID)
	if sessionID == "" {
		return nil, fmt.Errorf("search_replace 缺少 session_id")
	}
	remotePath := strings.TrimSpace(tool.Params["path"])
	if remotePath == "" {
		return nil, fmt.Errorf("search_replace 缺少 path")
	}
	operationsRaw := tool.Params["operations"]
	operations, err := parseSearchReplaceOperations(operationsRaw)
	if err != nil {
		return nil, err
	}
	fileProvider := mcpFileProvider{app: a}
	originalContent, err := fileProvider.ReadTextFileContext(context.Background(), sessionID, remotePath)
	if err != nil {
		return nil, err
	}
	preview, err := mcpserver.BuildSearchReplaceReviewPreview(remotePath, originalContent, operations)
	if err != nil {
		return nil, err
	}
	if preview.Failure != nil {
		return nil, errors.New(formatChangeReviewFailure(preview.Failure, 0))
	}
	return &aiToolRestoreState{
		Version:   1,
		ReviewID:  reviewID,
		SessionID: sessionID,
		ToolName:  strings.TrimSpace(tool.Name),
		Summary:   summarizeParsedToolUse(tool),
		CreatedAt: time.Now().UnixMilli(),
		Files: []aiToolRestoreFileSnapshot{
			{
				Path:           remotePath,
				BeforeContent:  preview.OriginalContent,
				AppliedContent: preview.PreviewContent,
				ExistedBefore:  true,
				ExistsAfter:    true,
			},
		},
	}, nil
}

func (a *App) buildEditFileRestoreState(tool aiParsedToolUse, payload AIChatRequestPayload, reviewID string) (*aiToolRestoreState, error) {
	sessionID := strings.TrimSpace(payload.SessionID)
	if sessionID == "" {
		return nil, fmt.Errorf("edit_file 缺少 session_id")
	}
	remotePath := strings.TrimSpace(tool.Params["path"])
	if remotePath == "" {
		return nil, fmt.Errorf("edit_file 缺少 path")
	}
	expectedReplacements := 1
	if rawExpected := strings.TrimSpace(tool.Params["expected_replacements"]); rawExpected != "" {
		parsedExpected, err := strconv.Atoi(rawExpected)
		if err != nil || parsedExpected < 1 {
			return nil, fmt.Errorf("edit_file expected_replacements 非法")
		}
		expectedReplacements = parsedExpected
	}
	fileProvider := mcpFileProvider{app: a}
	originalContent, err := fileProvider.ReadTextFileContext(context.Background(), sessionID, remotePath)
	if err != nil {
		return nil, err
	}
	preview, err := mcpserver.BuildEditFileReviewPreview(remotePath, originalContent, tool.Params["old_string"], tool.Params["new_string"], expectedReplacements)
	if err != nil {
		return nil, err
	}
	if preview.Failure != nil {
		return nil, errors.New(formatChangeReviewFailure(preview.Failure, 0))
	}
	return &aiToolRestoreState{
		Version:   1,
		ReviewID:  reviewID,
		SessionID: sessionID,
		ToolName:  strings.TrimSpace(tool.Name),
		Summary:   summarizeParsedToolUse(tool),
		CreatedAt: time.Now().UnixMilli(),
		Files: []aiToolRestoreFileSnapshot{
			{
				Path:           remotePath,
				BeforeContent:  preview.OriginalContent,
				AppliedContent: preview.PreviewContent,
				ExistedBefore:  true,
				ExistsAfter:    true,
			},
		},
	}, nil
}

func (a *App) buildApplyPatchRestoreState(tool aiParsedToolUse, payload AIChatRequestPayload, reviewID string) (*aiToolRestoreState, error) {
	sessionID := strings.TrimSpace(payload.SessionID)
	if sessionID == "" {
		return nil, fmt.Errorf("apply_patch 缺少 session_id")
	}
	patchPayload := tool.Params["patch"]
	if strings.TrimSpace(patchPayload) == "" {
		return nil, fmt.Errorf("apply_patch 缺少 patch")
	}
	preview, err := mcpserver.BuildApplyPatchReviewPreview(patchPayload, func(remotePath string) (string, error) {
		content, exists, readErr := a.readAIRestoreTargetState(context.Background(), sessionID, remotePath)
		if readErr != nil {
			return "", readErr
		}
		if !exists {
			return "", os.ErrNotExist
		}
		return content, nil
	})
	if err != nil {
		return nil, err
	}
	if preview.Failure != nil {
		return nil, errors.New(formatChangeReviewFailure(preview.Failure, 0))
	}
	files := make([]aiToolRestoreFileSnapshot, 0, len(preview.Files))
	for _, file := range preview.Files {
		files = append(files, aiToolRestoreFileSnapshot{
			Path:           file.Path,
			BeforeContent:  file.Before,
			AppliedContent: file.After,
			ExistedBefore:  file.ExistedBefore,
			ExistsAfter:    file.ExistsAfter,
		})
	}
	return &aiToolRestoreState{
		Version:   1,
		ReviewID:  reviewID,
		SessionID: sessionID,
		ToolName:  strings.TrimSpace(tool.Name),
		Summary:   summarizeParsedToolUse(tool),
		CreatedAt: time.Now().UnixMilli(),
		Files:     files,
	}, nil
}

func (a *App) buildAIChatToolRestoreState(tool aiParsedToolUse, payload AIChatRequestPayload, reviewID string) (*aiToolRestoreState, error) {
	conversationID := strings.TrimSpace(payload.ConversationID)
	if conversationID == "" {
		return nil, fmt.Errorf("当前会话缺少 conversation_id")
	}
	var state *aiToolRestoreState
	var err error
	switch strings.TrimSpace(tool.Name) {
	case "apply_diff":
		state, err = a.buildApplyDiffRestoreState(tool, payload, reviewID)
	case "write_to_file":
		state, err = a.buildWriteToFileRestoreState(tool, payload, reviewID)
	case "search_replace":
		state, err = a.buildSearchReplaceRestoreState(tool, payload, reviewID)
	case "edit_file":
		state, err = a.buildEditFileRestoreState(tool, payload, reviewID)
	case "apply_patch":
		state, err = a.buildApplyPatchRestoreState(tool, payload, reviewID)
	default:
		return nil, fmt.Errorf("当前状态不支持还原")
	}
	if err != nil {
		return nil, err
	}
	state.ConversationID = conversationID
	return state, nil
}

type aiToolRestoreArtifactResult struct {
	ArtifactPath string
	CopyContent  string
}

func (a *App) persistAIChatToolRestoreArtifact(tool aiParsedToolUse, payload AIChatRequestPayload, reviewID string, requestID string) (aiToolRestoreArtifactResult, error) {
	if a == nil || a.configManager == nil {
		return aiToolRestoreArtifactResult{}, fmt.Errorf("config manager unavailable")
	}
	state, err := a.buildAIChatToolRestoreState(tool, payload, reviewID)
	if err != nil {
		return aiToolRestoreArtifactResult{}, err
	}
	state.RequestID = strings.TrimSpace(requestID)
	artifactPath, err := a.configManager.WriteAIConversationRestoreArtifact(state)
	if err != nil {
		return aiToolRestoreArtifactResult{}, err
	}
	return aiToolRestoreArtifactResult{
		ArtifactPath: artifactPath,
		CopyContent:  strings.TrimSpace(buildAIRestoreUnifiedPatch(state.Files)),
	}, nil
}

func (a *App) PreviewAIChatToolRestore(artifactPath string, sessionID string) (map[string]interface{}, error) {
	trimmedArtifactPath := strings.TrimSpace(artifactPath)
	trimmedSessionID := strings.TrimSpace(sessionID)
	if a == nil || a.configManager == nil || trimmedArtifactPath == "" {
		return nil, fmt.Errorf("当前状态不支持还原")
	}
	state, err := a.configManager.ReadAIConversationRestoreArtifact(trimmedArtifactPath)
	if err != nil || state == nil {
		return nil, fmt.Errorf("当前状态不支持还原")
	}
	if trimmedSessionID != "" && strings.TrimSpace(state.SessionID) != "" && trimmedSessionID != strings.TrimSpace(state.SessionID) {
		return nil, fmt.Errorf("当前状态不支持还原")
	}
	if err := a.verifyAIRestoreState(context.Background(), state); err != nil {
		return nil, fmt.Errorf("当前状态不支持还原")
	}
	return a.buildAIRestoreReviewPayload(state), nil
}

func (a *App) RestoreAIChatTool(artifactPath string, sessionID string) error {
	trimmedArtifactPath := strings.TrimSpace(artifactPath)
	trimmedSessionID := strings.TrimSpace(sessionID)
	if a == nil || a.configManager == nil || trimmedArtifactPath == "" {
		return fmt.Errorf("当前状态不支持还原")
	}
	state, err := a.configManager.ReadAIConversationRestoreArtifact(trimmedArtifactPath)
	if err != nil || state == nil {
		return fmt.Errorf("当前状态不支持还原")
	}
	if trimmedSessionID != "" && strings.TrimSpace(state.SessionID) != "" && trimmedSessionID != strings.TrimSpace(state.SessionID) {
		return fmt.Errorf("当前状态不支持还原")
	}
	if err := a.verifyAIRestoreState(context.Background(), state); err != nil {
		return fmt.Errorf("当前状态不支持还原")
	}
	fileProvider := mcpFileProvider{app: a}
	for _, file := range state.Files {
		if file.ExistedBefore {
			if err := fileProvider.WriteTextFileContext(context.Background(), state.SessionID, file.Path, file.BeforeContent); err != nil {
				return err
			}
			continue
		}
		if err := fileProvider.DeleteFileContext(context.Background(), state.SessionID, file.Path); err != nil && !isAIRestoreTargetMissing(err) {
			return err
		}
	}
	return nil
}