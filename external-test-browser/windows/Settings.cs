using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Web;
using System.Web.Script.Serialization;

namespace ClassroomConsole
{
    internal static class Json
    {
        internal static string Encode(object value) { return new JavaScriptSerializer { MaxJsonLength = 65536 }.Serialize(value); }
        internal static Dictionary<string, object> Object(string value)
        {
            if (value == null || value.Length > 65536) throw new InvalidDataException("데이터가 너무 큽니다.");
            var result = new JavaScriptSerializer { MaxJsonLength = 65536, RecursionLimit = 16 }.DeserializeObject(value) as Dictionary<string, object>;
            if (result == null) throw new InvalidDataException("올바른 JSON 객체가 아닙니다.");
            return result;
        }
        internal static string Text(Dictionary<string, object> value, string key)
        {
            object result;
            return value.TryGetValue(key, out result) ? result as string : null;
        }
        internal static string Script(object value)
        {
            return Encode(value).Replace("<", "\\u003c").Replace(">", "\\u003e").Replace("\u2028", "\\u2028").Replace("\u2029", "\\u2029");
        }
    }

    internal sealed class ConsoleSettings
    {
        internal readonly string[] Urls;
        internal ConsoleSettings(string[] urls)
        {
            if (urls == null || urls.Length != 4) throw new InvalidDataException("화면 네 개의 주소를 입력해 주세요.");
            Urls = new string[4];
            for (var index = 0; index < 4; index++) Urls[index] = ValidateUrl(urls[index]).AbsoluteUri;
        }

        internal static Uri ValidateUrl(string value)
        {
            Uri uri;
            if (value == null || value.Length > 4096 || !Uri.TryCreate(value.Trim(), UriKind.Absolute, out uri)
                || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps) || !String.IsNullOrEmpty(uri.UserInfo) || String.IsNullOrEmpty(uri.Host))
                throw new InvalidDataException("로그인 정보가 없는 http:// 또는 https:// 주소를 입력해 주세요.");
            return uri;
        }

        internal static ConsoleSettings FromSiteUrl(string value)
        {
            var site = ValidateUrl(value);
            if (site.AbsolutePath != "/" && site.AbsolutePath != "/index.html") throw new InvalidDataException("일반 학생 사이트 주소를 입력해 주세요.");
            var student = new UriBuilder(site) { Path = "/", Fragment = "" };
            var teacher = new UriBuilder(student.Uri) { Path = "/teacher/", Fragment = "/lobby" };
            return new ConsoleSettings(new[] { teacher.Uri.AbsoluteUri, student.Uri.AbsoluteUri, student.Uri.AbsoluteUri, student.Uri.AbsoluteUri });
        }

        internal static ConsoleSettings Load(string root, string variant, string legacyRoot)
        {
            var saved = Path.Combine(root, "settings-" + variant + ".json");
            if (File.Exists(saved))
            {
                var value = Json.Object(File.ReadAllText(saved, Encoding.UTF8));
                object raw;
                var urls = value.TryGetValue("urls", out raw) ? raw as object[] : null;
                if (urls == null || urls.Length != 4) throw new InvalidDataException("저장한 화면 주소를 읽지 못했습니다.");
                return new ConsoleSettings(Array.ConvertAll(urls, item => item as string));
            }
            var name = variant == "hana" ? "config.hana.json" : "config.json";
            var defaults = Program.ResourceText(name);
            if (legacyRoot != null && File.Exists(Path.Combine(legacyRoot, name))) defaults = File.ReadAllText(Path.Combine(legacyRoot, name), Encoding.UTF8);
            var result = FromSiteUrl(Json.Text(Json.Object(defaults), "siteUrl"));
            result.Save(root, variant);
            return result;
        }

        internal void Save(string root, string variant)
        {
            Files.WriteAtomic(Path.Combine(root, "settings-" + variant + ".json"), Encoding.UTF8.GetBytes(Json.Encode(new { urls = Urls })));
        }

        internal static string Origin(Uri uri)
        {
            var host = uri.IdnHost.ToLowerInvariant();
            if (uri.HostNameType == UriHostNameType.IPv6) host = "[" + System.Net.IPAddress.Parse(uri.DnsSafeHost).ToString().ToLowerInvariant() + "]";
            return uri.Scheme.ToLowerInvariant() + "://" + host + (uri.IsDefaultPort ? "" : ":" + uri.Port);
        }
        internal static string Tenant(Uri uri)
        {
            var values = HttpUtility.ParseQueryString(uri.Query).GetValues("tenant");
            var first = values == null || values.Length == 0 || String.IsNullOrEmpty(values[0]) ? "minjun" : values[0];
            return first.Trim().ToLowerInvariant();
        }
        internal static string Scope(Uri uri) { return Json.Encode(new[] { Origin(uri), Tenant(uri) }); }
        internal static bool AllowsLogin(string source, string configured)
        {
            Uri current;
            if (!Uri.TryCreate(source, UriKind.Absolute, out current)) return false;
            var expected = new Uri(configured);
            return Origin(current) == Origin(expected) && Tenant(current) == Tenant(expected) && current.AbsolutePath == expected.AbsolutePath;
        }
    }
}
