# DSE ECON Tools 一鍵更新腳本
Write-Host "=== 開始更新 GitHub 及 Vercel ===" -ForegroundColor Cyan
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
$message = "更新工具 $timestamp"
git add .
git commit -m $message
git push
Write-Host "=== 更新完成！Vercel 會自動部署 ===" -ForegroundColor Green
Write-Host "稍等約30秒後重新整理網頁即可看到最新版本" -ForegroundColor Yellow
