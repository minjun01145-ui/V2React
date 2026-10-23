param([switch]$Tests)
$ErrorActionPreference = 'Stop'
$sourceRoot = $PSScriptRoot
$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $sourceRoot '..\..'))
$sdkVersion = '1.0.4314.35'
$packageHash = '90778DEB1B77E36292828B4B5833C9255C27533F40E0DDD55891AE718944EDC4'
$buildCache = Join-Path $repositoryRoot '.cache\classroom-native'
$outputFolder = Join-Path $sourceRoot '..\dist'
New-Item -ItemType Directory -Path $buildCache -Force | Out-Null
New-Item -ItemType Directory -Path $outputFolder -Force | Out-Null
$package = Join-Path $buildCache "microsoft.web.webview2.$sdkVersion.nupkg"
if (-not (Test-Path -LiteralPath $package)) {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $download = New-Object Net.WebClient
    try { $download.DownloadFile("https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/$sdkVersion/microsoft.web.webview2.$sdkVersion.nupkg", $package) }
    finally { $download.Dispose() }
}
$sha = [Security.Cryptography.SHA256]::Create()
try { $actualHash = [BitConverter]::ToString($sha.ComputeHash([IO.File]::ReadAllBytes($package))).Replace('-', '') }
finally { $sha.Dispose() }
if ($actualHash -ne $packageHash) { throw 'WebView2 SDK package checksum mismatch.' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::OpenRead($package)
try {
    $entries = @{
        'lib/net462/Microsoft.Web.WebView2.Core.dll' = 'Microsoft.Web.WebView2.Core.dll'
        'lib/net462/Microsoft.Web.WebView2.WinForms.dll' = 'Microsoft.Web.WebView2.WinForms.dll'
        'runtimes/win-x64/native/WebView2Loader.dll' = 'WebView2Loader.dll'
        'LICENSE.txt' = 'WebView2-LICENSE.txt'
    }
    foreach ($name in $entries.Keys) {
        [IO.Compression.ZipFileExtensions]::ExtractToFile($archive.GetEntry($name), (Join-Path $buildCache $entries[$name]), $true)
    }
} finally { $archive.Dispose() }
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $compiler)) { throw 'Windows .NET Framework 4.8 is required.' }
$executable = Join-Path $outputFolder 'ClassroomConsole.exe'
$entryPoint = 'ClassroomConsole.Program'
$sources = @('Program.cs', 'Settings.cs', 'LoginStore.cs', 'ConsoleForm.cs') | ForEach-Object { Join-Path $sourceRoot $_ }
if ($Tests) {
    $executable = Join-Path $buildCache 'ConsoleTests.exe'
    $entryPoint = 'ClassroomConsole.NativeTests'
    $sources += Join-Path $sourceRoot 'NativeTests.cs'
}
$arguments = @('/nologo', '/target:winexe', '/platform:x64', '/optimize+', '/utf8output', '/codepage:65001', "/main:$entryPoint", "/out:$executable", "/win32manifest:$(Join-Path $sourceRoot 'app.manifest')")
$arguments += @('/reference:System.dll', '/reference:System.Core.dll', '/reference:System.Drawing.dll', '/reference:System.Windows.Forms.dll', '/reference:System.Security.dll', '/reference:System.Web.dll', '/reference:System.Web.Extensions.dll')
foreach ($name in @('Microsoft.Web.WebView2.Core.dll', 'Microsoft.Web.WebView2.WinForms.dll')) {
    $path = Join-Path $buildCache $name
    $arguments += "/reference:$path"
    $arguments += "/resource:$path,$name"
}
$arguments += "/resource:$(Join-Path $buildCache 'WebView2Loader.dll'),WebView2Loader.dll"
$arguments += "/resource:$(Join-Path $buildCache 'WebView2-LICENSE.txt'),WebView2-LICENSE.txt"
foreach ($name in @('login.js', 'legacy-export.mjs')) { $arguments += "/resource:$(Join-Path $sourceRoot $name),$name" }
foreach ($name in @('config.json', 'config.hana.json')) { $arguments += "/resource:$(Join-Path $sourceRoot "..\$name"),$name" }
& $compiler @arguments @sources
if ($LASTEXITCODE -ne 0) { throw 'Native console build failed.' }
$file = Get-Item -LiteralPath $executable
Write-Output ("{0} ({1:N2} MiB)" -f $file.FullName, ($file.Length / 1MB))
