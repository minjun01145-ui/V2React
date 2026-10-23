using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace ClassroomConsole
{
    internal static class NativeTests
    {
        private static readonly List<string> Checks = new List<string>();
        private static string root, site;
        private static int exitCode = 1;

        [STAThread]
        private static int Main(string[] args)
        {
            Program.RegisterEmbeddedAssemblies();
            return Run(args);
        }

        [MethodImpl(MethodImplOptions.NoInlining)]
        private static int Run(string[] args)
        {
            root = Path.GetFullPath(args[0]); site = args[1];
            Directory.CreateDirectory(root);
            try
            {
                if (!new Uri(site).IsLoopback) throw new Exception("Tests require a loopback fixture.");
                Contracts();
                Program.InitializeWebView(root);
                Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false);
                var settings = ConsoleSettings.FromSiteUrl(site);
                var form = new ConsoleForm(root, Path.Combine(root, "browser-first"), "default", settings);
                form.WindowState = FormWindowState.Normal;
                form.Shown += async delegate
                {
                    try
                    {
                        await BrowserTests(form, settings);
                        exitCode = 0;
                        File.WriteAllText(Path.Combine(root, "report.json"), Json.Encode(new { passed = true, checks = Checks }), Encoding.UTF8);
                    }
                    catch (Exception error)
                    {
                        File.WriteAllText(Path.Combine(root, "report.json"), Json.Encode(new { passed = false, checks = Checks, error = error.Message, stack = error.StackTrace }), Encoding.UTF8);
                    }
                    finally { foreach (Form open in new List<Form>(OpenForms())) open.Close(); Application.ExitThread(); }
                };
                form.Show(); Application.Run();
            }
            catch (Exception error) { File.WriteAllText(Path.Combine(root, "report.json"), Json.Encode(new { passed = false, checks = Checks, error = error.Message, stack = error.StackTrace }), Encoding.UTF8); }
            return exitCode;
        }

        private static IEnumerable<Form> OpenForms() { foreach (Form form in Application.OpenForms) yield return form; }
        private static void Assert(bool condition, string label) { if (!condition) throw new Exception(label); }
        private static void Pass(string label) { Checks.Add(label); }
        private static void Reject(Action action, string label) { try { action(); } catch { return; } throw new Exception(label); }

        private static void Contracts()
        {
            foreach (var url in new[] { "file:///C:/secret", "javascript:alert(1)", "https://user:password@example.com/", "", "not a URL" })
                Reject(() => ConsoleSettings.ValidateUrl(url), "Unsafe URL accepted");
            var urlA = "https://example.test/?tenant=hana&room=one";
            var urlB = "https://example.test/?tenant=hana&room=two";
            Assert(ConsoleSettings.Origin(new Uri("http://[::1]:5173/")) == "http://[::1]:5173", "IPv6 origin normalization failed");
            Assert(ConsoleSettings.AllowsLogin(urlB, urlA), "Rooms should share remembered logins");
            Assert(!ConsoleSettings.AllowsLogin(urlA.Replace("tenant=hana", "tenant=minjun"), urlA), "Tenant boundary failed");
            Assert(!ConsoleSettings.AllowsLogin(urlA.Replace("example.test", "other.test"), urlA), "Origin boundary failed");
            Assert(!ConsoleSettings.AllowsLogin("https://example.test/other?tenant=hana", urlA), "Path boundary failed");
            var store = new LoginStore(root);
            var secret = "native-" + Guid.NewGuid().ToString("N");
            store.Save(0, urlA, new Dictionary<string, object> { { "email", "teacher@example.test" }, { "password", secret } });
            Assert(Json.Text(store.Read(0, urlB), "password") == secret, "Encrypted login round trip failed");
            Assert(store.Read(1, urlA) == null && store.Read(0, urlA.Replace("tenant=hana", "tenant=minjun")) == null, "Remembered login isolation failed");
            Assert(!Encoding.UTF8.GetString(File.ReadAllBytes(store.FileFor(0, urlA))).Contains(secret), "Plaintext password on disk");
            File.Copy(store.FileFor(0, urlA), store.FileFor(1, urlA), true);
            Reject(() => store.Read(1, urlA), "Copied credentials were accepted by another pane");
            File.Delete(store.FileFor(1, urlA));
            Reject(() => store.Save(1, urlA, new Dictionary<string, object> { { "studentNumber", "9991" }, { "name", "학생" }, { "pin", "bad" } }), "Invalid PIN accepted");
            var concurrentUrl = "https://concurrent.example.test/";
            Parallel.For(0, 12, index => store.Save(0, concurrentUrl, new Dictionary<string, object> { { "email", "teacher@example.test" }, { "password", "concurrent-" + index } }));
            Assert(Json.Text(store.Read(0, concurrentUrl), "password").StartsWith("concurrent-"), "Concurrent console writes corrupted credentials");
            var settings = ConsoleSettings.FromSiteUrl(site); settings.Save(root, "default");
            Assert(ConsoleSettings.Load(root, "default", null).Urls[0] == settings.Urls[0], "Settings round trip failed");
            Pass("URL validation, origin/tenant/role isolation, Windows-encrypted credential storage and settings persistence");
        }

        private static async Task Until(Func<Task<bool>> predicate, string label)
        {
            var deadline = DateTime.UtcNow.AddSeconds(30);
            while (!await predicate()) { if (DateTime.UtcNow > deadline) throw new Exception("Timed out: " + label); await Task.Delay(40); }
        }
        private static Task<bool> Is(bool value) { return Task.FromResult(value); }
        private static async Task<object> Eval(BrowserPane pane, string expression)
        {
            var text = await pane.View.CoreWebView2.CallDevToolsProtocolMethodAsync("Runtime.evaluate", Json.Encode(new { expression = expression, returnByValue = true, awaitPromise = true }));
            var response = Json.Object(text);
            if (response.ContainsKey("exceptionDetails")) throw new Exception("Browser fixture evaluation failed");
            var result = (Dictionary<string, object>)response["result"];
            object value; return result.TryGetValue("value", out value) ? value : null;
        }
        private static async Task<bool> True(BrowserPane pane, string expression) { return Object.Equals(await Eval(pane, expression), true); }
        private static Task Input(BrowserPane pane, string selector, string value)
        {
            return Eval(pane, "(()=>{const input=document.querySelector(" + Json.Script(selector) + ");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input," + Json.Script(value) + ");input.dispatchEvent(new Event('input',{bubbles:true}));})()");
        }
        private static Task Submit(BrowserPane pane, string selector) { return Eval(pane, "document.querySelector(" + Json.Script(selector) + ").requestSubmit()"); }
        private static async Task Ready(ConsoleForm form)
        {
            await Until(() => Is(form.Panes[0].Status == "ready"), "teacher loads");
            for (var index = 1; index < 4; index++) if (form.Panes[index].Status == "off") form.Panes[index].Enable.PerformClick();
            await Until(() => Is(Array.TrueForAll(form.Panes, pane => pane.Status == "ready")), "four independent pages load");
            foreach (var pane in form.Panes) await Until(() => True(pane, "Boolean(window.fixture)"), "React fixture mounts");
        }

        private static async Task BrowserTests(ConsoleForm form, ConsoleSettings settings)
        {
            await Until(() => Is(form.Panes[0].Status == "ready"), "teacher starts automatically");
            for (var index = 1; index < 4; index++) Assert(form.Panes[index].Status == "off" && form.Panes[index].View == null, "Disabled pane was loaded");
            await Ready(form);
            var panes = form.Panes;
            var profiles = new HashSet<string>();
            foreach (var pane in panes)
            {
                profiles.Add(pane.View.CoreWebView2.Profile.ProfileName);
                Assert(pane.View.CoreWebView2.Profile.IsInPrivateModeEnabled, "Profile writes browsing state to disk");
                await Eval(pane, "window.saveAccount('" + pane.Index + "')");
                Assert(Object.Equals(await Eval(pane, "localStorage.getItem('account')"), pane.Index.ToString()), "localStorage isolation failed");
                Assert(Object.Equals(await Eval(pane, "window.loadAccount()"), pane.Index.ToString()), "IndexedDB isolation failed");
                var cookies = await pane.View.CoreWebView2.CookieManager.GetCookiesAsync(settings.Urls[1]);
                Assert(cookies.Exists(cookie => cookie.Name == "account" && cookie.Value == pane.Index.ToString()), "Cookie isolation failed");
                for (var attempt = 0; attempt < 2; attempt++) Assert(Object.Equals(await Eval(pane, "fetch('/cached-resource?pane=" + pane.Index + "').then(r=>r.text())"), "cacheable resource"), "Cache resource fetch failed");
                Assert(await True(pane, "typeof require==='undefined' && typeof window.testBrowser==='undefined'"), "Unexpected native bridge on page");
            }
            Assert(profiles.Count == 4, "Four panes share a browser profile");
            Pass("Teacher-only startup; four private profiles isolate cookies, localStorage and IndexedDB; resources are fetched without HTTP cache");

            for (var mode = 0; mode < 4; mode++)
            {
                form.ModeButtons[mode + 1].PerformClick();
                Assert(form.Mode == mode && panes[mode].Card.Visible, "Single-screen mode failed");
                foreach (var pane in panes) Assert(Object.Equals(await Eval(pane, "localStorage.getItem('account')"), pane.Index.ToString()), "View switching reset a page");
            }
            var ticks = Convert.ToInt32(await Eval(panes[0], "window.ticks"));
            await Until(async () => Convert.ToInt32(await Eval(panes[0], "window.ticks")) > ticks + 2, "hidden teacher keeps running");
            var frames = Convert.ToInt32(await Eval(panes[0], "window.framesRendered"));
            await Until(async () => Convert.ToInt32(await Eval(panes[0], "window.framesRendered")) > frames + 2, "covered teacher animation keeps running");
            Assert(await True(panes[0], "document.visibilityState==='visible'"), "Enlarging a pane hides and pauses another game's document");
            form.ModeButtons[0].PerformClick();
            Assert(Array.TrueForAll(panes, pane => pane.Card.Visible), "Grid did not restore all panes");
            form.ClientSize = new Size(1237, 811);
            Assert(panes[3].Card.Right <= form.ClientSize.Width && panes[3].Card.Bottom <= form.ClientSize.Height, "Panes exceed resized window");
            await Screenshot(form, "native-grid.png");
            form.ModeButtons[1].PerformClick(); await Screenshot(form, "native-teacher.png"); form.ModeButtons[0].PerformClick();
            Pass("All five view modes preserve page state; hidden screens keep running; resize and real WebView screenshots");

            var logins = new LoginStore(root);
            var password = "teacher-" + Guid.NewGuid().ToString("N");
            await Input(panes[0], "#admin-email", "teacher@example.test"); await Input(panes[0], "#admin-password", password); await Submit(panes[0], "form");
            await Until(() => Is(logins.Read(0, settings.Urls[0]) != null), "successful teacher login saved");
            await panes[0].SaveTask;
            for (var index = 1; index < 4; index++)
            {
                var pane = panes[index];
                await Input(pane, "#student-number", (9990 + index).ToString()); await Input(pane, "#student-name", "학생" + index); await Submit(pane, "form");
                await Until(() => True(pane, "Boolean(document.querySelector('[name=pin]'))"), "student PIN step");
                await Input(pane, "[name=pin]", (1110 + index).ToString()); await Submit(pane, "[role=dialog] form");
                await Until(() => Is(logins.Read(pane.Index, settings.Urls[pane.Index]) != null), "successful student login saved");
                await pane.SaveTask;
            }
            Pass("Real React teacher login and all three two-step student logins are encrypted and saved after success");
            form.Close(); form.Dispose();
            var reopened = new ConsoleForm(root, Path.Combine(root, "browser-second"), "default", settings) { WindowState = FormWindowState.Normal };
            reopened.Show(); await Ready(reopened);
            panes = reopened.Panes;
            foreach (var pane in panes)
            {
                await Until(() => True(pane, "window.fixture.stage==='success'"), "automatic login in a fresh browser session");
                Assert(Convert.ToInt32(await Eval(pane, "window.loginAttempts")) == (pane.Index == 0 ? 1 : 2), "Repeated automatic login attempt");
                Assert(await True(pane, "localStorage.getItem('account')===null"), "Private browser data survived session restart");
            }
            Pass("Fresh browser sessions retain only encrypted logins and automatically sign in the teacher and all three students");

            var student = panes[1];
            await student.View.CoreWebView2.CallDevToolsProtocolMethodAsync("Input.dispatchMouseEvent", Json.Encode(new { type = "mousePressed", x = 20, y = 20, button = "left", clickCount = 1 }));
            await student.View.CoreWebView2.CallDevToolsProtocolMethodAsync("Input.dispatchMouseEvent", Json.Encode(new { type = "mouseReleased", x = 20, y = 20, button = "left", clickCount = 1 }));
            await Eval(student, "window.fixture.reset()");
            await Until(() => True(student, "Boolean(document.querySelector('#student-number'))"), "manual login reset");
            await Input(student, "#student-number", "9994"); await Input(student, "#student-name", "새 학생"); await Submit(student, "form");
            await Until(() => True(student, "Boolean(document.querySelector('[name=pinConfirmation]'))"), "new PIN setup");
            Assert(await True(student, "document.querySelector('[name=pin]').value===''"), "Old PIN filled a new student's setup");
            await Input(student, "[name=pin]", "4444"); await Input(student, "[name=pinConfirmation]", "4444"); await Submit(student, "[role=dialog] form");
            await Until(() => Is(Json.Text(logins.Read(1, settings.Urls[1]), "pin") == "4444"), "new PIN saved"); await student.SaveTask;
            Pass("Trusted user input stops automatic submission; another student's PIN setup stays blank and can save a new PIN");

            await Eval(student, "window.fixture.reset()");
            await Until(() => True(student, "Boolean(document.querySelector('#student-number'))"), "rejected login reset");
            await Input(student, "#student-number", "9991"); await Input(student, "#student-name", "학생1"); await Submit(student, "form");
            await Until(() => True(student, "Boolean(document.querySelector('[name=pin]'))"), "rejected PIN step");
            Assert(await True(student, "document.querySelector('[name=pin]').value===''"), "Old PIN filled another student's login");
            await Input(student, "[name=pin]", "0000"); await Submit(student, "[role=dialog] form");
            await Until(() => True(student, "document.querySelector('[role=alert]')?.textContent==='로그인 실패'"), "failed login stays editable");
            Assert(Json.Text(logins.Read(1, settings.Urls[1]), "pin") == "4444", "Rejected login overwrote a saved PIN");
            Pass("Rejected logins never overwrite saved credentials; an old PIN never fills a different student's form");

            var framed = panes[3];
            var beforeFrame = Files.Hash(File.ReadAllBytes(logins.FileFor(3, settings.Urls[3])));
            await Eval(framed, "(()=>{const frame=document.createElement('iframe');frame.src=" + Json.Script(settings.Urls[3]) + ";document.body.append(frame)})()");
            await Until(() => True(framed, "Boolean(document.querySelector('iframe').contentWindow.fixture)"), "embedded login frame");
            Assert(await True(framed, "document.querySelector('iframe').contentWindow.fixture.number===''"), "A subframe received saved login data");
            await Eval(framed, "document.querySelector('iframe').contentWindow.chrome.webview.postMessage({type:'classroom-save-login',login:{studentNumber:'1234',name:'frame',pin:'1234'}})");
            await Task.Delay(150);
            Assert(Files.Hash(File.ReadAllBytes(logins.FileFor(3, settings.Urls[3]))) == beforeFrame, "A subframe overwrote saved credentials");
            Pass("Embedded frames cannot receive or save the top-level pane's login credentials");

            var original = File.ReadAllBytes(logins.FileFor(1, settings.Urls[1]));
            student.View.CoreWebView2.Navigate(settings.Urls[1].Replace("tenant=hana", "tenant=minjun"));
            await Until(() => Is(student.Status == "ready"), "other tenant loads");
            await Until(() => True(student, "Boolean(window.fixture)"), "other tenant fixture");
            Assert(await True(student, "window.fixture.number==='' && window.fixture.name===''"), "Credentials leaked to another tenant");
            await Eval(student, "chrome.webview.postMessage({type:'classroom-save-login',login:{studentNumber:'1234',name:'foreign',pin:'1234'}})");
            await Task.Delay(150);
            Assert(Files.Hash(File.ReadAllBytes(logins.FileFor(1, settings.Urls[1]))) == Files.Hash(original), "Foreign tenant overwrote saved credentials");
            student.View.CoreWebView2.Navigate(settings.Urls[1].Replace("127.0.0.1", "localhost"));
            await Until(() => Is(student.Status == "ready"), "other origin loads");
            await Until(() => True(student, "Boolean(window.fixture)"), "other origin fixture");
            Assert(await True(student, "window.fixture.number==='' && window.fixture.name===''"), "Credentials leaked to another origin");
            Pass("Other origins and tenants never autofill and cannot overwrite the configured pane's credentials");

            var unavailable = panes[2]; unavailable.View.CoreWebView2.Navigate(new Uri(new Uri(site), "/offline").AbsoluteUri);
            await Until(() => Is(unavailable.Status == "error"), "connection error is visible");
            unavailable.Reload.PerformClick();
            await Until(() => Is(unavailable.Status == "ready"), "retry original URL");
            await Until(() => True(unavailable, "window.fixture?.stage==='success'"), "automatic login after retry");
            Pass("Connection failures show a retry action which restores the configured site and automatic login");
            reopened.Close(); reopened.Dispose();
        }

        private static async Task Screenshot(ConsoleForm form, string name)
        {
            await Task.Delay(150); // Let the embedded compositor finish resizing.
            var previews = new Dictionary<int, byte[]>();
            foreach (var pane in form.Panes)
            {
                if ((form.Mode >= 0 && form.Mode != pane.Index) || pane.Status != "ready") continue;
                await Eval(pane, "new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))");
                using (var stream = new MemoryStream())
                {
                    await pane.View.CoreWebView2.CapturePreviewAsync(Microsoft.Web.WebView2.Core.CoreWebView2CapturePreviewImageFormat.Png, stream);
                    previews[pane.Index] = stream.ToArray();
                }
            }
            using (var bitmap = new Bitmap(form.Width, form.Height))
            {
                form.DrawToBitmap(bitmap, new Rectangle(Point.Empty, form.Size));
                using (var graphics = Graphics.FromImage(bitmap))
                {
                    foreach (var pane in form.Panes)
                    {
                        if ((form.Mode >= 0 && form.Mode != pane.Index) || pane.Status != "ready") continue;
                        using (var stream = new MemoryStream(previews[pane.Index]))
                        using (var image = Image.FromStream(stream))
                        {
                            var screen = pane.View.PointToScreen(Point.Empty);
                            var position = new Point(screen.X - form.Left, screen.Y - form.Top);
                            graphics.DrawImage(image, new Rectangle(position, pane.View.ClientSize));
                        }
                    }
                }
                bitmap.Save(Path.Combine(root, name), System.Drawing.Imaging.ImageFormat.Png);
            }
        }
    }
}
