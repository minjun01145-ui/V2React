using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace ClassroomConsole
{
    internal sealed class BrowserPane
    {
        internal int Index;
        internal string Url;
        internal string Status = "off";
        internal string ScriptId;
        internal string PasswordError = "";
        internal Panel Card, Content, StatusPanel;
        internal Label Message;
        internal Button Select, Reload, Enable;
        internal WebView2 View;
        internal Task SaveTask = Task.FromResult(0);
    }

    internal sealed class ConsoleForm : Form
    {
        internal static readonly string[] Labels = { "교사화면", "테스트화면 1", "테스트화면 2", "테스트화면 3" };
        internal readonly BrowserPane[] Panes = new BrowserPane[4];
        internal readonly Button[] ModeButtons = new Button[5];
        internal int Mode = -1, Active;
        internal uint BrowserProcessId;
        internal bool RestartRequested;
        private readonly string dataRoot, browserData, variant;
        private readonly ConsoleSettings settings;
        private readonly LoginStore logins;
        private readonly FlowLayoutPanel toolbar = new FlowLayoutPanel();
        private readonly Panel canvas = new Panel();
        private Task<CoreWebView2Environment> environment;
        private bool closing;
        private static readonly Color Accent = Color.FromArgb(37, 99, 235);

        internal static string TitleFor(string variant) { return variant == "hana" ? "교실 수업 콘솔 · 하나쌤" : "교실 수업 콘솔"; }

        internal ConsoleForm(string dataRoot, string browserData, string variant, ConsoleSettings settings)
        {
            this.dataRoot = dataRoot; this.browserData = browserData; this.variant = variant; this.settings = settings;
            logins = new LoginStore(dataRoot);
            Text = TitleFor(variant);
            Font = new Font("맑은 고딕", 9F);
            AutoScaleMode = AutoScaleMode.Dpi;
            ClientSize = new Size(1600, 1000);
            MinimumSize = new Size(1050, 720);
            StartPosition = FormStartPosition.CenterScreen;
            WindowState = FormWindowState.Maximized;
            BackColor = Color.FromArgb(16, 24, 39);
            Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
            toolbar.Dock = DockStyle.Top; toolbar.Height = 52; toolbar.Padding = new Padding(8);
            toolbar.WrapContents = false; toolbar.BackColor = BackColor;
            var labels = new[] { "모아서 보기", "교사화면만 보기", "테스트화면 1", "테스트화면 2", "테스트화면 3" };
            for (var index = 0; index < labels.Length; index++)
            {
                var mode = index - 1;
                var button = MakeButton(labels[index]);
                button.AutoSize = true; button.Height = 34; button.Padding = new Padding(10, 0, 10, 0);
                button.Click += delegate { SetMode(mode); };
                toolbar.Controls.Add(button); ModeButtons[index] = button;
            }
            var addresses = MakeButton("주소 설정"); addresses.AutoSize = true; addresses.Height = 34;
            addresses.Click += delegate { EditSettings(); }; toolbar.Controls.Add(addresses);
            var other = MakeButton(variant == "hana" ? "기본 교실 열기" : "하나쌤 교실 열기"); other.AutoSize = true; other.Height = 34;
            other.Click += delegate { StartConsole(variant == "hana" ? "default" : "hana"); }; toolbar.Controls.Add(other);
            canvas.Dock = DockStyle.Fill; canvas.Resize += delegate { LayoutPanes(); };
            Controls.Add(canvas); Controls.Add(toolbar);
            for (var index = 0; index < Panes.Length; index++) Panes[index] = CreatePane(index);
            SetMode(-1);
            Shown += async delegate
            {
                var options = new CoreWebView2EnvironmentOptions
                {
                    Language = "ko-KR", TargetCompatibleBrowserVersion = "120.0.0.0",
                    AdditionalBrowserArguments = "--disable-http-cache --disable-gpu-shader-disk-cache --disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows --disable-features=CalculateNativeWinOcclusion"
                };
                environment = CoreWebView2Environment.CreateAsync(null, browserData, options);
                await EnablePaneAsync(0);
            };
        }

        private static Button MakeButton(string text)
        {
            var button = new Button { Text = text, FlatStyle = FlatStyle.Flat, BackColor = Color.White, ForeColor = Color.FromArgb(23, 32, 51), Cursor = Cursors.Hand, UseVisualStyleBackColor = false };
            button.FlatAppearance.BorderSize = 0;
            return button;
        }

        private BrowserPane CreatePane(int index)
        {
            var pane = new BrowserPane { Index = index, Url = settings.Urls[index] };
            pane.Card = new Panel { BackColor = Color.FromArgb(71, 85, 105), Padding = new Padding(3) };
            var body = new Panel { Dock = DockStyle.Fill, BackColor = Color.White };
            var header = new Panel { Dock = DockStyle.Top, Height = 36, BackColor = Color.FromArgb(241, 245, 249) };
            pane.Select = MakeButton(Labels[index]); pane.Select.Dock = DockStyle.Fill; pane.Select.TextAlign = ContentAlignment.MiddleLeft;
            pane.Select.Click += delegate { SelectPane(index, true); };
            pane.Reload = MakeButton("↻"); pane.Reload.AccessibleName = Labels[index] + " 새로고침";
            pane.Reload.Dock = DockStyle.Right; pane.Reload.Width = 44; pane.Reload.Enabled = false;
            pane.Reload.Click += delegate { ReloadPane(index); };
            header.Controls.Add(pane.Select); header.Controls.Add(pane.Reload);
            pane.Content = new Panel { Dock = DockStyle.Fill };
            pane.StatusPanel = new Panel { Dock = DockStyle.Fill, BackColor = Color.White };
            pane.Message = new Label { Text = "꺼져 있음", AutoSize = false, TextAlign = ContentAlignment.MiddleCenter, Dock = DockStyle.Fill };
            pane.Enable = MakeButton("켜기"); pane.Enable.AccessibleName = Labels[index] + " 켜기";
            pane.Enable.Size = new Size(110, 38); pane.Enable.Anchor = AnchorStyles.None;
            pane.Enable.Click += async delegate { SelectPane(index, false); await EnablePaneAsync(index); };
            var statusLayout = new TableLayoutPanel { Dock = DockStyle.Fill, RowCount = 3, ColumnCount = 1 };
            statusLayout.RowStyles.Add(new RowStyle(SizeType.Percent, 50)); statusLayout.RowStyles.Add(new RowStyle(SizeType.Absolute, 46)); statusLayout.RowStyles.Add(new RowStyle(SizeType.Percent, 50));
            statusLayout.Controls.Add(pane.Message, 0, 0); statusLayout.Controls.Add(pane.Enable, 0, 1);
            pane.StatusPanel.Controls.Add(statusLayout); pane.Content.Controls.Add(pane.StatusPanel);
            body.Controls.Add(pane.Content); body.Controls.Add(header); pane.Card.Controls.Add(body); canvas.Controls.Add(pane.Card);
            return pane;
        }

        internal async Task EnablePaneAsync(int index)
        {
            var pane = Panes[index];
            if (pane.Status != "off") return;
            SetStatus(pane, "loading", "불러오는 중…");
            try
            {
                var browser = await environment;
                if (closing) return;
                var controller = browser.CreateCoreWebView2ControllerOptions();
                controller.ProfileName = "classroom-" + index + "-" + Files.Hash(System.Text.Encoding.UTF8.GetBytes(ConsoleSettings.Scope(new Uri(pane.Url)))).Substring(0, 16);
                // Only encrypted logins persist. Cookies and game storage live in
                // four independent in-memory profiles for this console session.
                controller.IsInPrivateModeEnabled = true;
                pane.View = new WebView2 { Dock = DockStyle.Fill, DefaultBackgroundColor = Color.White, Visible = false };
                pane.Content.Controls.Add(pane.View);
                pane.View.Enter += delegate { SelectPane(index, false); };
                await pane.View.EnsureCoreWebView2Async(browser, controller);
                if (closing) return;
                var core = pane.View.CoreWebView2;
                BrowserProcessId = core.BrowserProcessId;
                core.Settings.AreHostObjectsAllowed = false;
                core.Settings.AreDevToolsEnabled = false;
                core.Settings.IsStatusBarEnabled = false;
                core.Settings.IsPasswordAutosaveEnabled = false;
                core.Settings.IsGeneralAutofillEnabled = false;
                await core.CallDevToolsProtocolMethodAsync("Network.enable", "{}");
                await core.CallDevToolsProtocolMethodAsync("Network.setCacheDisabled", "{\"cacheDisabled\":true}");
                core.NewWindowRequested += delegate(object sender, CoreWebView2NewWindowRequestedEventArgs args) { args.Handled = true; };
                core.NavigationStarting += delegate(object sender, CoreWebView2NavigationStartingEventArgs args)
                {
                    Uri uri;
                    if (!Uri.TryCreate(args.Uri, UriKind.Absolute, out uri) || (uri.Scheme != "http" && uri.Scheme != "https")) { args.Cancel = true; return; }
                    SetStatus(pane, "loading", "불러오는 중…");
                };
                core.NavigationCompleted += delegate(object sender, CoreWebView2NavigationCompletedEventArgs args)
                {
                    if (closing) return;
                    if (args.IsSuccess) SetStatus(pane, "ready", "");
                    else if (args.WebErrorStatus != CoreWebView2WebErrorStatus.OperationCanceled) SetStatus(pane, "error", "연결하지 못했습니다 (" + args.WebErrorStatus + "). 새로고침해 주세요.");
                };
                core.ProcessFailed += delegate { if (!closing) SetStatus(pane, "error", "화면이 종료되었습니다. 새로고침해 주세요."); };
                core.WebMessageReceived += delegate(object sender, CoreWebView2WebMessageReceivedEventArgs args) { pane.SaveTask = SaveLoginAsync(pane, args); };
                await UpdateLoginScriptAsync(pane);
                if (!closing) core.Navigate(pane.Url);
            }
            catch (Exception)
            {
                if (!closing) SetStatus(pane, "error", "화면을 열지 못했습니다. 새로고침해 주세요.");
            }
        }

        private async Task UpdateLoginScriptAsync(BrowserPane pane)
        {
            Dictionary<string, object> login = null;
            try { login = logins.Read(pane.Index, pane.Url); }
            catch { pane.PasswordError = "비밀번호 읽기 실패"; }
            var uri = new Uri(pane.Url);
            var context = new { origin = ConsoleSettings.Origin(uri), path = uri.AbsolutePath, tenant = ConsoleSettings.Tenant(uri), teacher = pane.Index == 0, login = login };
            var script = Program.ResourceText("login.js").Replace("__CLASSROOM_CONTEXT__", Json.Script(context));
            var core = pane.View.CoreWebView2;
            if (pane.ScriptId != null) core.RemoveScriptToExecuteOnDocumentCreated(pane.ScriptId);
            pane.ScriptId = await core.AddScriptToExecuteOnDocumentCreatedAsync(script);
            UpdateHeader(pane);
        }

        private async Task SaveLoginAsync(BrowserPane pane, CoreWebView2WebMessageReceivedEventArgs args)
        {
            if (closing || !ConsoleSettings.AllowsLogin(args.Source, pane.Url) || !ConsoleSettings.AllowsLogin(pane.View.CoreWebView2.Source, pane.Url)) return;
            try
            {
                var message = Json.Object(args.WebMessageAsJson);
                object value;
                if (Json.Text(message, "type") != "classroom-save-login" || !message.TryGetValue("login", out value)) return;
                logins.Save(pane.Index, pane.Url, value as Dictionary<string, object>);
                pane.PasswordError = "";
                await UpdateLoginScriptAsync(pane);
            }
            catch { if (!closing) pane.PasswordError = "비밀번호 저장 실패"; }
            if (!closing) UpdateHeader(pane);
        }

        private void UpdateHeader(BrowserPane pane)
        {
            pane.Select.Text = Labels[pane.Index] + (pane.PasswordError.Length == 0 ? "" : " · " + pane.PasswordError);
        }

        private void SetStatus(BrowserPane pane, string status, string message)
        {
            pane.Status = status; pane.Message.Text = message;
            pane.Enable.Visible = status == "off";
            pane.Reload.Enabled = status != "off" && status != "loading";
            pane.StatusPanel.Visible = status != "ready";
            if (pane.View != null) { pane.View.Visible = status == "ready"; if (status == "ready") pane.View.BringToFront(); }
        }

        internal void SelectPane(int index, bool focus)
        {
            if (Mode != -1 && Mode != index) return;
            Active = index;
            for (var current = 0; current < Panes.Length; current++)
            {
                Panes[current].Card.BackColor = current == Active ? Accent : Color.FromArgb(71, 85, 105);
                Panes[current].Select.ForeColor = current == Active ? Accent : Color.FromArgb(23, 32, 51);
            }
            if (focus && Panes[index].View != null && Panes[index].Status == "ready") Panes[index].View.Focus();
        }

        internal void SetMode(int mode)
        {
            Mode = mode;
            for (var index = 0; index < ModeButtons.Length; index++)
            {
                ModeButtons[index].BackColor = index - 1 == mode ? Accent : Color.White;
                ModeButtons[index].ForeColor = index - 1 == mode ? Color.White : Color.FromArgb(23, 32, 51);
            }
            LayoutPanes();
            if (Panes[0] != null) SelectPane(mode == -1 ? Active : mode, true);
        }

        private void LayoutPanes()
        {
            var margin = 8; var gap = 8;
            var width = Math.Max(1, canvas.ClientSize.Width - margin * 2);
            var height = Math.Max(1, canvas.ClientSize.Height - margin * 2);
            var halfWidth = (width - gap) / 2; var halfHeight = (height - gap) / 2;
            for (var index = 0; index < Panes.Length; index++)
            {
                var pane = Panes[index]; if (pane == null) continue;
                // Keep other WebViews visible behind the enlarged pane. Setting
                // Visible=false stops requestAnimationFrame and pauses games.
                pane.Card.Visible = true;
                pane.Card.Bounds = Mode != index
                    ? new Rectangle(margin + (index % 2 == 1 ? halfWidth + gap : 0), margin + (index >= 2 ? halfHeight + gap : 0), index % 2 == 1 ? width - halfWidth - gap : halfWidth, index >= 2 ? height - halfHeight - gap : halfHeight)
                    : new Rectangle(margin, margin, width, height);
            }
            if (Mode >= 0 && Panes[Mode] != null) Panes[Mode].Card.BringToFront();
        }

        internal void ReloadPane(int index)
        {
            var pane = Panes[index];
            if (pane.Status == "off") return;
            SelectPane(index, false);
            if (pane.View == null || pane.View.CoreWebView2 == null)
            {
                if (pane.View != null) { pane.View.Dispose(); pane.View = null; }
                pane.Status = "off"; var retry = EnablePaneAsync(index); return;
            }
            if (pane.Status == "error") pane.View.CoreWebView2.Navigate(pane.Url);
            else pane.View.CoreWebView2.Reload();
        }

        protected override bool ProcessCmdKey(ref Message message, Keys keyData)
        {
            if (keyData == Keys.F5 || keyData == (Keys.Control | Keys.R)) { ReloadPane(Active); return true; }
            return base.ProcessCmdKey(ref message, keyData);
        }
        protected override void WndProc(ref Message message)
        {
            if (message.Msg == 0x8001) { if (WindowState == FormWindowState.Minimized) WindowState = FormWindowState.Maximized; Show(); Activate(); }
            base.WndProc(ref message);
        }
        protected override void OnFormClosed(FormClosedEventArgs args)
        {
            closing = true;
            foreach (var pane in Panes) if (pane != null && pane.View != null) pane.View.Dispose();
            environment = null;
            base.OnFormClosed(args);
        }

        internal static void StartConsole(string variant)
        {
            Process.Start(new ProcessStartInfo(Application.ExecutablePath, variant == "hana" ? "--hana" : "--default") { UseShellExecute = false });
        }

        private void EditSettings()
        {
            using (var dialog = new Form { Text = "화면 주소 설정", ClientSize = new Size(780, 300), Font = Font, StartPosition = FormStartPosition.CenterParent, FormBorderStyle = FormBorderStyle.FixedDialog, MaximizeBox = false, MinimizeBox = false })
            {
                var inputs = new TextBox[4];
                for (var index = 0; index < 4; index++)
                {
                    dialog.Controls.Add(new Label { Text = Labels[index], Bounds = new Rectangle(16, 24 + index * 48, 112, 30), TextAlign = ContentAlignment.MiddleLeft });
                    inputs[index] = new TextBox { Text = settings.Urls[index], MaxLength = 4096, Bounds = new Rectangle(130, 28 + index * 48, 628, 28) };
                    dialog.Controls.Add(inputs[index]);
                }
                var save = new Button { Text = "저장 후 다시 열기", Bounds = new Rectangle(574, 244, 184, 36) };
                save.Click += delegate
                {
                    try
                    {
                        new ConsoleSettings(Array.ConvertAll(inputs, input => input.Text)).Save(dataRoot, variant);
                        dialog.DialogResult = DialogResult.OK;
                    }
                    catch (Exception error) { MessageBox.Show(dialog, error.Message, "주소를 저장하지 못했습니다", MessageBoxButtons.OK, MessageBoxIcon.Error); }
                };
                var license = new Button { Text = "라이선스", Bounds = new Rectangle(16, 244, 100, 36) };
                license.Click += delegate { MessageBox.Show(dialog, Program.ResourceText("WebView2-LICENSE.txt"), "Microsoft WebView2 라이선스"); };
                dialog.Controls.Add(save); dialog.Controls.Add(license); dialog.AcceptButton = save;
                if (dialog.ShowDialog(this) == DialogResult.OK) { RestartRequested = true; Close(); }
            }
        }
    }
}
