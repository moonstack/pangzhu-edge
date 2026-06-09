@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
rem EXT_ID = 本地"加载解压缩"开发版的 ID(由 extension 文件夹路径派生)。
rem 不带参数即用默认值(从 G:\talk\pagetalk\extension 加载时的 ID);可手动传入覆盖。
rem 授权清单里同时放商店版 CRX ID,所以开发版/商店版都能连。
if "%~1"=="" (
  set "EXT_ID=lfemjddippghehocfflfppcfmimkabmn"
) else (
  set "EXT_ID=%~1"
)
set "STORE_ID=palanohmdiinhicjjomcnklginnihcpk"
rem 取干净的绝对路径(去掉 .. ),避免 Edge 校验原生宿主清单路径时不认
pushd "%~dp0.." >nul
set "ROOT=%CD%"
popd >nul
for /f "delims=" %%p in ('npm prefix -g') do set "NPMG=%%p"
set "CLAUDE_EXE=%NPMG%\node_modules\@anthropic-ai\claude-code\bin\claude.exe"
for /f "delims=" %%n in ('where node') do set "NODE_EXE=%%n"

if not exist "%CLAUDE_EXE%" (
  echo 错误: 找不到 claude.exe : %CLAUDE_EXE%
  exit /b 1
)

rem 1) host/config.json
> "%ROOT%\host\config.json" echo {"claudeExe":"%CLAUDE_EXE:\=\\%","cwd":"%ROOT:\=\\%\\host"}

rem 2) run-host.cmd (浏览器启动它 -> node host.js)
> "%ROOT%\scripts\run-host.cmd" echo @echo off
>> "%ROOT%\scripts\run-host.cmd" echo "%NODE_EXE%" "%ROOT%\host\src\host.js"

rem 3) native messaging 清单(含扩展ID与启动器路径)
> "%ROOT%\scripts\com.pagetalk.host.json" echo {
>> "%ROOT%\scripts\com.pagetalk.host.json" echo   "name": "com.pagetalk.host",
>> "%ROOT%\scripts\com.pagetalk.host.json" echo   "description": "PageTalk native host",
>> "%ROOT%\scripts\com.pagetalk.host.json" echo   "path": "%ROOT:\=\\%\\scripts\\run-host.cmd",
>> "%ROOT%\scripts\com.pagetalk.host.json" echo   "type": "stdio",
>> "%ROOT%\scripts\com.pagetalk.host.json" echo   "allowed_origins": ["chrome-extension://%EXT_ID%/", "chrome-extension://%STORE_ID%/"]
>> "%ROOT%\scripts\com.pagetalk.host.json" echo }

rem 4) 注册表(Edge)
reg add "HKCU\Software\Microsoft\Edge\NativeMessagingHosts\com.pagetalk.host" /ve /t REG_SZ /d "%ROOT%\scripts\com.pagetalk.host.json" /f

echo.
echo 安装完成。请完全关闭并重开 Edge,然后点扩展图标打开侧边栏。
endlocal
