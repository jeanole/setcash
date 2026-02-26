$timestamp = Get-Date -Format 'yyyyMMddHHmmss'
$tmp = "$env:TEMP\dotfiles-sync-$timestamp"

git clone --depth=1 --filter=blob:none --sparse https://github.com/jeanole/dotfiles $tmp 2>&1
git -C $tmp ls-tree --name-only HEAD | Select-String -Pattern '^\.claude(-[a-z]+-template|-template)$'
