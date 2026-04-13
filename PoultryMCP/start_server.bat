@echo off
echo Starting Poultry Management Server & Bot...
npx pm2 start ecosystem.config.cjs
npx pm2 save
echo.
echo ------------------------------------------
echo Server is now running in the BACKGROUND.
echo It will stay ONLINE even if you close this window.
echo Website: http://localhost:3000
echo ------------------------------------------
pause
