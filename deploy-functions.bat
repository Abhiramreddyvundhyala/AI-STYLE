@echo off
echo ============================================
echo  Deploying All Edge Functions
echo ============================================
echo.

echo [1/6] generate-universal (primary AI engine)...
call npx supabase functions deploy generate-universal --no-verify-jwt
if %ERRORLEVEL% NEQ 0 ( echo ERROR: generate-universal failed & pause & exit /b 1 )
echo Done.
echo.

echo [2/6] get-job-status (polling endpoint)...
call npx supabase functions deploy get-job-status --no-verify-jwt
if %ERRORLEVEL% NEQ 0 ( echo ERROR: get-job-status failed & pause & exit /b 1 )
echo Done.
echo.

echo [3/6] generate-hd (post-purchase HD)...
call npx supabase functions deploy generate-hd --no-verify-jwt
if %ERRORLEVEL% NEQ 0 ( echo ERROR: generate-hd failed & pause & exit /b 1 )
echo Done.
echo.

echo [4/6] generate-preview (deprecated stub)...
call npx supabase functions deploy generate-preview --no-verify-jwt
if %ERRORLEVEL% NEQ 0 ( echo ERROR: generate-preview failed & pause & exit /b 1 )
echo Done.
echo.

echo [5/6] generate-with-face-matching (deprecated stub)...
call npx supabase functions deploy generate-with-face-matching --no-verify-jwt
if %ERRORLEVEL% NEQ 0 ( echo ERROR: generate-with-face-matching failed & pause & exit /b 1 )
echo Done.
echo.

echo [6/6] encrypt-prompt (deprecated stub)...
call npx supabase functions deploy encrypt-prompt --no-verify-jwt
if %ERRORLEVEL% NEQ 0 ( echo ERROR: encrypt-prompt failed & pause & exit /b 1 )
echo Done.
echo.

echo ============================================
echo  All 6 functions deployed successfully!
echo ============================================
echo.
echo Verify in Supabase Dashboard ^> Edge Functions
echo Required secrets (Settings ^> Edge Functions ^> Secrets):
echo   OPENAI_API_KEY   (or GPT_IMAGE_API_KEY)
echo   SUPABASE_URL
echo   SUPABASE_SERVICE_ROLE_KEY
echo.
pause
