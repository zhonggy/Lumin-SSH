//go:build !windows

package main

import (
	"fmt"
	"os/exec"
)

// launchInstaller 启动安装向导（Unix 下直接执行）
func launchInstaller(targetPath string) error {
	cmd := exec.Command(targetPath)
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start setup: %w", err)
	}
	return nil
}

// restartApp 重启应用
func restartApp(exePath string) error {
	cmd := exec.Command(exePath)
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to restart application: %w", err)
	}
	return nil
}
