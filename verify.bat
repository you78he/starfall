@echo off
rem 跑一遍完整验证：无头逻辑测试 + 真实浏览器渲染测试 + 性能剖析
cd /d "%~dp0"
echo === 1/3 无头逻辑测试 ===
node test\headless.mjs
if errorlevel 1 goto fail
echo.
echo === 2/3 浏览器渲染测试 ===
node test\screenshot.mjs
if errorlevel 1 goto fail
echo.
echo === 3/3 性能剖析（逻辑 / 渲染分项，取中位数）===
node test\profile.mjs
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
