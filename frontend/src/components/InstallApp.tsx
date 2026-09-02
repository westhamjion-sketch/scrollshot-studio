import { Download, MoreVertical, Share, Smartphone, X } from "lucide-react";
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

declare global {
  interface Navigator {
    standalone?: boolean;
  }
}

export function InstallApp() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [installed, setInstalled] = useState(false);
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
    setInstalled(standalone);

    const capturePrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const markInstalled = () => {
      setInstalled(true);
      setShowGuide(false);
      setPromptEvent(null);
    };
    window.addEventListener("beforeinstallprompt", capturePrompt);
    window.addEventListener("appinstalled", markInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", capturePrompt);
      window.removeEventListener("appinstalled", markInstalled);
    };
  }, []);

  if (installed) return null;

  async function install() {
    if (promptEvent) {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      setPromptEvent(null);
      if (choice.outcome === "dismissed") setShowGuide(true);
      return;
    }
    setShowGuide(true);
  }

  return (
    <>
      <button className="install-trigger" type="button" onClick={install}>
        <Download size={14} /> 安装 App
      </button>
      {showGuide && (
        <div className="install-overlay" role="presentation" onClick={() => setShowGuide(false)}>
          <section className="install-sheet" role="dialog" aria-modal="true" aria-labelledby="install-title" onClick={(event) => event.stopPropagation()}>
            <button className="install-close" type="button" aria-label="关闭安装说明" onClick={() => setShowGuide(false)}><X size={19} /></button>
            <div className="app-glyph"><Smartphone size={28} /></div>
            <small>{isIOS ? "IPHONE 安装" : "手机安装"}</small>
            <h2 id="install-title">把「卷轴」放到主屏幕</h2>
            {isIOS ? (
              <ol>
                <li><span>1</span><p>点击 Safari 底部的<strong><Share size={16} /> 分享</strong></p></li>
                <li><span>2</span><p>向上滑，选择<strong>添加到主屏幕</strong></p></li>
                <li><span>3</span><p>点击右上角<strong>添加</strong></p></li>
              </ol>
            ) : (
              <ol>
                <li><span>1</span><p>点击浏览器右上角的<strong><MoreVertical size={16} /> 菜单</strong></p></li>
                <li><span>2</span><p>选择<strong>安装应用</strong>或<strong>添加到主屏幕</strong></p></li>
                <li><span>3</span><p>确认安装，桌面会出现「卷轴」图标</p></li>
              </ol>
            )}
            <button className="install-done" type="button" onClick={() => setShowGuide(false)}>知道了</button>
          </section>
        </div>
      )}
    </>
  );
}
