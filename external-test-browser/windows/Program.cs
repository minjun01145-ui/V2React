using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;

[assembly: AssemblyTitle("교실 수업 콘솔")]
[assembly: AssemblyProduct("V2React Classroom Console")]
[assembly: AssemblyVersion("1.0.0.0")]

namespace ClassroomConsole
{
    internal static class Program
    {
        internal const string SdkVersion = "1.0.4314.35";
        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        private static extern IntPtr FindWindow(string className, string windowName);
        [DllImport("user32.dll")]
        private static extern bool PostMessage(IntPtr window, int message, IntPtr wParam, IntPtr lParam);

        [STAThread]
        private static int Main(string[] args)
        {
            RegisterEmbeddedAssemblies();
            try { return Run(args); }
            catch (Exception error)
            {
                MessageBox.Show("수업 콘솔을 열지 못했습니다.\n" + error.Message, "교실 수업 콘솔", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return 1;
            }
        }

        internal static void RegisterEmbeddedAssemblies()
        {
            AppDomain.CurrentDomain.AssemblyResolve += delegate(object sender, ResolveEventArgs args)
            {
                var name = new AssemblyName(args.Name).Name;
                if (name != "Microsoft.Web.WebView2.Core" && name != "Microsoft.Web.WebView2.WinForms") return null;
                return Assembly.Load(ResourceBytes(name + ".dll"));
            };
        }

        // Keep WebView2 types out of the entry point's JIT compilation until the
        // embedded-assembly resolver is installed. No DLL sits beside the EXE.
        [MethodImpl(MethodImplOptions.NoInlining)]
        private static int Run(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            var dataRoot = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "V2React", "ClassroomConsole");
            Directory.CreateDirectory(dataRoot);
            if (args.Length == 4 && args[0] == "--import-legacy" && args[2] == "--report")
            {
                var imported = LegacyLogins.Import(args[1], dataRoot);
                Files.WriteAtomic(args[3], Encoding.UTF8.GetBytes(Json.Encode(new { imported = imported, saved = Directory.GetFiles(Path.Combine(dataRoot, "logins"), "*.bin").Length })));
                return 0;
            }
            var variant = Array.IndexOf(args, "--hana") >= 0 ? "hana" : Array.IndexOf(args, "--default") >= 0 ? "default" : Environment.GetEnvironmentVariable("CONSOLE_VARIANT") == "hana" ? "hana" : "default";
            var restart = false;
            bool created;
            using (var mutex = new Mutex(true, "Local\\V2React.ClassroomConsole." + variant, out created))
            {
                if (!created)
                {
                    PostMessage(FindWindow(null, ConsoleForm.TitleFor(variant)), 0x8001, IntPtr.Zero, IntPtr.Zero);
                    return 0;
                }
                InitializeWebView(dataRoot);
                var legacyRoot = FindLegacyRoot();
                if (legacyRoot != null)
                {
                    try { LegacyLogins.Import(legacyRoot, dataRoot); }
                    catch { MessageBox.Show("기존 로그인 정보를 가져오지 못했습니다. 기존 파일은 보존되어 있습니다. 필요한 화면에서 다시 로그인해 주세요.", "로그인 정보 이전", MessageBoxButtons.OK, MessageBoxIcon.Warning); }
                }
                var settings = ConsoleSettings.Load(dataRoot, variant, legacyRoot);
                var browserData = Path.Combine(dataRoot, "browser-" + variant);
                Files.TryDeleteDirectory(dataRoot, browserData);
                using (var form = new ConsoleForm(dataRoot, browserData, variant, settings))
                {
                    Application.Run(form);
                    restart = form.RestartRequested;
                    var browserPid = form.BrowserProcessId;
                    form.Dispose();
                    GC.Collect();
                    GC.WaitForPendingFinalizers();
                    if (browserPid != 0)
                    {
                        try { using (var browser = Process.GetProcessById((int)browserPid)) browser.WaitForExit(3000); }
                        catch (ArgumentException) { }
                    }
                }
                Files.TryDeleteDirectory(dataRoot, browserData);
                mutex.ReleaseMutex();
            }
            if (restart) ConsoleForm.StartConsole(variant);
            return 0;
        }

        internal static void InitializeWebView(string dataRoot)
        {
            var folder = Path.Combine(dataRoot, "components", SdkVersion);
            Directory.CreateDirectory(folder);
            var loader = Path.Combine(folder, "WebView2Loader.dll");
            var bytes = ResourceBytes("WebView2Loader.dll");
            if (!File.Exists(loader) || Files.Hash(File.ReadAllBytes(loader)) != Files.Hash(bytes))
            {
                try { Files.WriteAtomic(loader, bytes); }
                catch (IOException)
                {
                    // The other classroom variant may have extracted the same
                    // loader and loaded it while this process was starting.
                    if (!File.Exists(loader) || Files.Hash(File.ReadAllBytes(loader)) != Files.Hash(bytes)) throw;
                }
            }
            CoreWebView2Environment.SetLoaderDllFolderPath(folder);
            try { CoreWebView2Environment.GetAvailableBrowserVersionString(); }
            catch (WebView2RuntimeNotFoundException)
            {
                throw new InvalidOperationException("Microsoft Edge WebView2 런타임이 필요합니다.\nhttps://developer.microsoft.com/microsoft-edge/webview2/");
            }
        }

        internal static byte[] ResourceBytes(string name)
        {
            using (var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(name))
            {
                if (stream == null) throw new InvalidOperationException("실행기 구성 요소가 없습니다: " + name);
                using (var output = new MemoryStream()) { stream.CopyTo(output); return output.ToArray(); }
            }
        }

        internal static string ResourceText(string name) { return Encoding.UTF8.GetString(ResourceBytes(name)).TrimStart('\uFEFF'); }

        internal static string FindLegacyRoot()
        {
            var directory = new DirectoryInfo(AppDomain.CurrentDomain.BaseDirectory);
            for (var depth = 0; depth < 3 && directory != null; depth++, directory = directory.Parent)
            {
                var candidates = new[] { directory.FullName, Path.Combine(directory.FullName, "external-test-browser") };
                foreach (var candidate in candidates)
                    if (File.Exists(Path.Combine(candidate, "config.json")) && (Directory.Exists(Path.Combine(candidate, ".profile")) || Directory.Exists(Path.Combine(candidate, ".profile-hana")))) return candidate;
            }
            return null;
        }

        internal static string QuoteArgument(string value)
        {
            var result = new StringBuilder("\"");
            int slashes = 0;
            foreach (char character in value)
            {
                if (character == '\\') { slashes++; continue; }
                result.Append('\\', character == '"' ? slashes * 2 + 1 : slashes);
                result.Append(character);
                slashes = 0;
            }
            return result.Append('\\', slashes * 2).Append('"').ToString();
        }
    }

    internal static class Files
    {
        internal static string Hash(byte[] bytes)
        {
            using (var sha = SHA256.Create()) return BitConverter.ToString(sha.ComputeHash(bytes)).Replace("-", "").ToLowerInvariant();
        }
        internal static void WriteAtomic(string path, byte[] bytes)
        {
            var absolute = Path.GetFullPath(path);
            // Both classroom variants can save the same site's credentials.
            // Serialize replacements across processes; Windows ReplaceFile can
            // otherwise fail with a sharing violation between two writers.
            using (var gate = new Mutex(false, "Local\\V2React.ClassroomConsole.Write." + Hash(Encoding.UTF8.GetBytes(absolute.ToUpperInvariant()))))
            {
                try { gate.WaitOne(); }
                catch (AbandonedMutexException) { }
                var temporary = absolute + "." + Guid.NewGuid().ToString("N") + ".tmp";
                try
                {
                    Directory.CreateDirectory(Path.GetDirectoryName(absolute));
                    File.WriteAllBytes(temporary, bytes);
                    if (File.Exists(absolute)) File.Replace(temporary, absolute, null);
                    else File.Move(temporary, absolute);
                }
                finally { if (File.Exists(temporary)) File.Delete(temporary); gate.ReleaseMutex(); }
            }
        }
        internal static void TryDeleteDirectory(string root, string path)
        {
            var prefix = Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
            if (!Path.GetFullPath(path).StartsWith(prefix, StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException("잘못된 임시 파일 경로입니다.");
            for (var attempt = 0; attempt < 3; attempt++)
            {
                try { if (Directory.Exists(path)) Directory.Delete(path, true); return; }
                catch (IOException) { Thread.Sleep(100); }
                catch (UnauthorizedAccessException) { return; }
            }
        }
    }
}
