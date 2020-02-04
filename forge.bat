@echo off

set MYHOME=%~dp0
rem To remove ending \ use %mypath:~0,-1% 

rem echo "node forge.js %*"
node "%MYHOME%\forge.js" %*
