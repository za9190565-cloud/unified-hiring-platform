@echo off
taskkill /F /IM node.exe 2>nul
cd email-engine
start cmd /k "node src/index.js"
