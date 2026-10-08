# 卷轴原生应用发布清单

## 应用身份

- 应用名称：卷轴
- 英文名称：Scrollshot Studio
- iOS Bundle ID：`com.westhamjion.scrollshot`
- Android Application ID：`com.westhamjion.scrollshot`
- 当前版本：`1.0.0`（构建号 `1`）
- 隐私政策：`https://scrollshot-studio-westhamjion.onrender.com/privacy.html`
- 支持页面：`https://github.com/westhamjion-sketch/scrollshot-studio/issues`

## 建议商店文案

### 副标题 / 简短说明

把滚动录屏还原成清晰长图

### 完整说明

卷轴可以把手机中的滚动录屏自动拼接为一张连续长图。它会识别真实滚动距离，减少固定标题栏、输入框和重复画面，让聊天记录、旅行方案、商品页面与长内容更方便保存和分享。

主要功能：

- 同时添加最多 10 段 MP4、MOV 或 M4V 录屏；
- 自动识别纵向滚动并生成 PNG 长图；
- 支持调整采样间隔和内容区域；
- 在 App 内预览结果；
- 通过系统面板保存或分享生成的长图。

视频只在你主动开始生成时上传，用于完成长图处理。当前版本不包含广告、账户系统或跨应用追踪。

### 分类建议

- App Store：照片与录像
- Google Play：工具

### 关键词建议

`长图,录屏,滚动截图,拼接,截图,PNG,视频转图片`

## 每次原生版本更新

```bash
cd /Users/liying/scrollshot-studio/frontend
npm install
npm run native:sync
```

`native:sync` 会使用 `.env.native` 中的 Render API 地址构建前端，然后复制到 iOS 和 Android 工程。

## iOS 提交流程

1. 安装完整 Xcode，并登录 Apple Developer 账号。
2. 运行 `npm run native:ios` 打开 Xcode。
3. 在 Signing & Capabilities 中选择开发者 Team，确认 Bundle ID 唯一。
4. 连接真机，验证视频选择、上传、后台切换、系统分享和网络失败状态。
5. 选择 Generic iOS Device，执行 Product → Archive。
6. 在 Organizer 中 Validate App，再上传到 App Store Connect。
7. 填写隐私问卷：照片或视频用于 App 功能，不与身份关联，不用于追踪。
8. 添加商店截图、隐私政策和审核说明后提交审核。

## Android 提交流程

1. 安装 Android Studio、JDK 和 Android SDK API 36。
2. 运行 `npm run native:android` 打开 Android Studio。
3. 在真机或模拟器上验证视频选择、上传、系统分享和返回键行为。
4. 使用 Build → Generate Signed App Bundle，创建或选择上传密钥。
5. 生成 release AAB 并上传 Google Play Console 的内部测试轨道。
6. 完成 Data safety、内容分级、隐私政策和商店资料。
7. 内部测试通过后再申请正式发布。

## 发布前必须补齐

- Apple Developer Program 和 Google Play Console 账号；
- Apple 签名 Team、发布证书和 provisioning profile；
- Android 上传密钥及安全备份；
- iPhone、iPad 和 Android 真机截图；
- 至少一次 iOS 与 Android 真机完整上传测试；
- 根据真实运营方式复核隐私政策、数据保留时间和商店隐私问卷。
