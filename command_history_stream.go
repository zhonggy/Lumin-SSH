package main

import (
	"bytes"
	"encoding/base64"
	"strings"
)

var historyMarkerStart = []byte("\x1fLUMIN_CMD\x1f")

const historyMarkerEnd byte = 0x1e

type commandHistoryStream struct {
	visibleCarry []byte
	payloadCarry []byte
	inMarker     bool
	lastCommand  string // 去重：记录上次解析出的命令
}

func newCommandHistoryStream() *commandHistoryStream {
	return &commandHistoryStream{}
}

func (s *commandHistoryStream) Process(chunk []byte) ([]byte, []string) {
	if len(chunk) == 0 {
		return nil, nil
	}

	// Fast path: no carry-over and no marker in chunk — pass through directly
	if len(s.visibleCarry) == 0 && !s.inMarker && !bytes.Contains(chunk, historyMarkerStart) {
		return chunk, nil
	}

	data := append(append([]byte{}, s.visibleCarry...), chunk...)
	s.visibleCarry = s.visibleCarry[:0]

	out := make([]byte, 0, len(data))
	commands := make([]string, 0, 1)

	for i := 0; i < len(data); {
		if s.inMarker {
			relEnd := bytes.IndexByte(data[i:], historyMarkerEnd)
			if relEnd == -1 {
				s.payloadCarry = append(s.payloadCarry, data[i:]...)
				return out, commands
			}

			end := i + relEnd
			s.payloadCarry = append(s.payloadCarry, data[i:end]...)
			if command := decodeHistoryMarkerPayload(s.payloadCarry); command != "" {
				if command != s.lastCommand {
					commands = append(commands, command)
					s.lastCommand = command
				}
			}
			s.payloadCarry = s.payloadCarry[:0]
			s.inMarker = false
			i = end + 1
			continue
		}

		relStart := bytes.Index(data[i:], historyMarkerStart)
		if relStart == -1 {
			remaining := data[i:]
			overlap := trailingMarkerPrefixLen(remaining)
			visibleEnd := len(remaining) - overlap
			if visibleEnd > 0 {
				out = append(out, remaining[:visibleEnd]...)
			}
			if overlap > 0 {
				s.visibleCarry = append(s.visibleCarry, remaining[visibleEnd:]...)
			}
			return out, commands
		}

		start := i + relStart
		if start > i {
			out = append(out, data[i:start]...)
		}
		i = start + len(historyMarkerStart)
		s.inMarker = true
	}

	return out, commands
}

func isInteractiveHistoryPrompt(command string) bool {
	text := strings.TrimSpace(command)
	lower := strings.ToLower(text)
	if text == "" {
		return true
	}
	for _, prefix := range []string{"choose ", "select ", "enter ", "input ", "please enter ", "press enter ", "would you like ", "do you have ", "port to use "} {
		if strings.HasPrefix(lower, prefix) {
			return true
		}
	}
	if !strings.HasSuffix(text, ":") && !strings.HasSuffix(text, "?") {
		return false
	}
	for _, marker := range []string{"default", "leave empty", "skip", "y/n", "yes/no", "option", "selection"} {
		if strings.Contains(lower, marker) {
			return true
		}
	}
	return false
}

func decodeHistoryMarkerPayload(payload []byte) string {
	if len(payload) == 0 {
		return ""
	}

	decoded, err := base64.StdEncoding.DecodeString(strings.TrimSpace(string(payload)))
	if err != nil {
		return ""
	}

	command := strings.TrimSpace(string(decoded))
	if isInteractiveHistoryPrompt(command) {
		return ""
	}
	return command
}

func trailingMarkerPrefixLen(data []byte) int {
	limit := len(historyMarkerStart)
	if len(data) < limit {
		limit = len(data)
	}

	for size := limit; size > 0; size-- {
		if bytes.Equal(data[len(data)-size:], historyMarkerStart[:size]) {
			return size
		}
	}

	return 0
}
