@echo off
rem 跑一遍完整验证：无头逻辑测试 + 真实浏览器渲染测试
cd /d "%~dp0"
echo === 1/2 无头逻辑测试 ===
node test\headless.mjs
if errorlevel 1 goto fail
echo.
echo === 2/2 浏览器渲染测试 ===
node test\screenshot.mjs
if errorlevel 1 goto fail
echo.
echo 全部通过。
pause
exit /b 0
:fail
echo.
echo 有测试未通过。
pause
exit /b 1
