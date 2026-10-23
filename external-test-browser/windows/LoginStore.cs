using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace ClassroomConsole
{
    internal sealed class LoginStore
    {
        private readonly string folder;
        private static readonly byte[] Entropy = Encoding.UTF8.GetBytes("V2React.ClassroomConsole.Login.v1");
        internal LoginStore(string dataRoot) { folder = Path.Combine(dataRoot, "logins"); Directory.CreateDirectory(folder); }
        internal string FileFor(int index, string url)
        {
            return Path.Combine(folder, Files.Hash(Encoding.UTF8.GetBytes(index + ":" + ConsoleSettings.Scope(new Uri(url)))) + ".bin");
        }

        internal static Dictionary<string, object> Validate(int index, Dictionary<string, object> value)
        {
            if (index < 0 || index > 3 || value == null) throw new InvalidDataException("올바른 로그인 정보가 아닙니다.");
            if (index == 0)
            {
                var email = Json.Text(value, "email");
                var password = Json.Text(value, "password");
                if (email == null || email.Length > 320 || String.IsNullOrEmpty(password) || password.Length > 4096) throw new InvalidDataException("올바른 교사 로그인 정보가 아닙니다.");
                return new Dictionary<string, object> { { "email", email.Trim() }, { "password", password } };
            }
            var number = Json.Text(value, "studentNumber");
            var name = Json.Text(value, "name");
            var pin = Json.Text(value, "pin");
            if (number == null || name == null || pin == null) throw new InvalidDataException("올바른 학생 로그인 정보가 아닙니다.");
            number = number.Normalize(NormalizationForm.FormKC).Trim();
            name = Regex.Replace(name.Normalize(NormalizationForm.FormKC).Trim(), @"\s+", " ");
            pin = pin.Normalize(NormalizationForm.FormKC).Trim();
            if (!Regex.IsMatch(number, "^[0-9]{1,12}$") || name.Length == 0 || name.Length > 30 || !Regex.IsMatch(pin, "^[0-9]{4}$")) throw new InvalidDataException("올바른 학생 로그인 정보가 아닙니다.");
            return new Dictionary<string, object> { { "studentNumber", number }, { "name", name }, { "pin", pin } };
        }

        internal Dictionary<string, object> Read(int index, string url)
        {
            var path = FileFor(index, url);
            if (!File.Exists(path)) return null;
            byte[] encrypted;
            using (var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read | FileShare.Delete))
            using (var memory = new MemoryStream())
            {
                if (stream.Length > 32768) throw new InvalidDataException("저장한 로그인 정보를 읽지 못했습니다.");
                stream.CopyTo(memory); encrypted = memory.ToArray();
            }
            var bytes = ProtectedData.Unprotect(encrypted, Entropy, DataProtectionScope.CurrentUser);
            var value = Json.Object(Encoding.UTF8.GetString(bytes));
            object storedIndex, login;
            if (!value.TryGetValue("index", out storedIndex) || !(storedIndex is int) || (int)storedIndex != index
                || Json.Text(value, "scope") != ConsoleSettings.Scope(new Uri(url)) || !value.TryGetValue("login", out login)) throw new InvalidDataException("로그인 정보의 화면 또는 사이트가 일치하지 않습니다.");
            return Validate(index, login as Dictionary<string, object>);
        }

        internal void Save(int index, string url, Dictionary<string, object> value)
        {
            var login = Validate(index, value);
            var record = new { index = index, scope = ConsoleSettings.Scope(new Uri(url)), login = login };
            var encrypted = ProtectedData.Protect(Encoding.UTF8.GetBytes(Json.Encode(record)), Entropy, DataProtectionScope.CurrentUser);
            Files.WriteAtomic(FileFor(index, url), encrypted);
        }
    }

    internal static class LegacyLogins
    {
        internal static int Import(string legacyRoot, string dataRoot)
        {
            legacyRoot = Path.GetFullPath(legacyRoot);
            var electron = Path.Combine(legacyRoot, "node_modules", "electron", "dist", "electron.exe");
            var store = new LoginStore(dataRoot);
            if (!File.Exists(electron)) return 0;
            if (File.Exists(Path.Combine(dataRoot, "legacy-imported-default")) && File.Exists(Path.Combine(dataRoot, "legacy-imported-hana"))) return 0;
            var script = Path.Combine(dataRoot, "components", "legacy-export-" + Guid.NewGuid().ToString("N") + ".mjs");
            Files.WriteAtomic(script, Program.ResourceBytes("legacy-export.mjs"));
            int imported = 0;
            foreach (var variant in new[] { "default", "hana" })
            {
                var marker = Path.Combine(dataRoot, "legacy-imported-" + variant);
                var profile = Path.Combine(legacyRoot, variant == "default" ? ".profile" : ".profile-hana");
                var config = Path.Combine(legacyRoot, variant == "default" ? "config.json" : "config.hana.json");
                if (File.Exists(marker) || !Directory.Exists(Path.Combine(profile, "remembered-logins")) || !File.Exists(config)) continue;
                var settings = ConsoleSettings.FromSiteUrl(Json.Text(Json.Object(File.ReadAllText(config, Encoding.UTF8)), "siteUrl"));
                var info = new ProcessStartInfo(electron, Program.QuoteArgument(script) + " " + Program.QuoteArgument(profile) + " " + Program.QuoteArgument(settings.Urls[1]))
                {
                    UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true,
                    StandardOutputEncoding = Encoding.UTF8, StandardErrorEncoding = Encoding.UTF8
                };
                info.EnvironmentVariables.Remove("ELECTRON_RUN_AS_NODE");
                using (var process = Process.Start(info))
                {
                    var output = process.StandardOutput.ReadToEndAsync();
                    var errors = process.StandardError.ReadToEndAsync();
                    if (!process.WaitForExit(15000)) { process.Kill(); throw new InvalidOperationException("기존 로그인 정보 이전 시간이 초과됐습니다."); }
                    if (process.ExitCode != 0) throw new InvalidOperationException("기존 암호화 로그인 정보를 읽지 못했습니다.");
                    // Credentials cross only the private child-process pipe, never
                    // command-line arguments, a plaintext file, or a diagnostic log.
                    var response = Json.Object(output.GetAwaiter().GetResult());
                    errors.GetAwaiter().GetResult();
                    object raw;
                    var records = response.TryGetValue("logins", out raw) ? raw as object[] : null;
                    if (records == null) throw new InvalidDataException("기존 로그인 정보 형식이 올바르지 않습니다.");
                    foreach (var record in records)
                    {
                        var item = record as Dictionary<string, object>;
                        object indexValue, value;
                        if (item == null || !item.TryGetValue("index", out indexValue) || !(indexValue is int) || (int)indexValue < 0 || (int)indexValue > 3 || !item.TryGetValue("login", out value)) throw new InvalidDataException("기존 로그인 정보 형식이 올바르지 않습니다.");
                        var index = (int)indexValue;
                        if (File.Exists(store.FileFor(index, settings.Urls[index]))) continue;
                        store.Save(index, settings.Urls[index], value as Dictionary<string, object>);
                        imported++;
                    }
                    Files.WriteAtomic(marker, new byte[] { 1 });
                }
            }
            File.Delete(script);
            return imported;
        }
    }
}
