param([switch]$Hana)
$ErrorActionPreference = 'Stop'
$executable = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\dist\ClassroomConsole.exe'))
$inputs = @('Program.cs', 'Settings.cs', 'LoginStore.cs', 'ConsoleForm.cs', 'login.js', 'legacy-export.mjs', 'app.manifest', 'build.ps1', '..\config.json', '..\config.hana.json') | ForEach-Object { Get-Item -LiteralPath (Join-Path $PSScriptRoot $_) }
if (-not (Test-Path -LiteralPath $executable) -or ($inputs | Where-Object { $_.LastWriteTimeUtc -gt (Get-Item -LiteralPath $executable).LastWriteTimeUtc })) {
    & (Join-Path $PSScriptRoot 'build.ps1')
}
$variant = if ($Hana) { '--hana' } else { '--default' }
Start-Process -FilePath $executable -ArgumentList $variant -WindowStyle Normal
