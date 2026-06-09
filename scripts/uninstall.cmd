@echo off
chcp 65001 >nul
reg delete "HKCU\Software\Microsoft\Edge\NativeMessagingHosts\com.pagetalk.host" /f
echo 已移除注册表项。可手动删除 scripts 下生成的 run-host.cmd 与 com.pagetalk.host.json。
