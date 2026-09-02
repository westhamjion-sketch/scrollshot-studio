# 卷轴 / Scrollshot Studio

把纵向滚动的手机录屏还原成一张连续、无损的 PNG 长图。产品复刻了本次对话中两段酒店推荐录屏的处理流程：固定标题栏和底部输入栏只保留一次，中间页面按真实滚动位移拼接。

## 快速开始

需要 Python 3.11+、Node.js 20+ 和 npm。

```bash
chmod +x run.sh start.sh stop.sh
./run.sh
```

打开 [http://127.0.0.1:5173](http://127.0.0.1:5173)。首次启动会自动建立 Python 虚拟环境并安装前后端依赖。

`run.sh` 用于首次安装和前台开发。日常使用独立后台模式：

```bash
./start.sh  # 启动，关闭终端后仍然运行
./stop.sh   # 停止
```

## 架构

```text
scrollshot-studio/
├── frontend/                  React + TypeScript + Vite
│   └── src/
│       ├── components/        上传、参数、进度、结果预览
│       ├── App.tsx            产品状态机与 API 编排
│       └── styles.css         响应式视觉系统
├── backend/                   FastAPI + 后台线程池
│   └── app/
│       ├── main.py            上传、任务状态、图片下载 API
│       ├── models.py          任务和拼接参数模型
│       └── services/
│           └── stitcher.py    帧采样、位移估计、去重和拼接
├── data/jobs/                 运行时任务文件（不提交 Git）
├── run.sh                     首次安装与前台开发
├── start.sh                   稳定后台启动
└── stop.sh                    停止后台服务
```

## 数据流

1. 浏览器以 `multipart/form-data` 上传 MP4/MOV/M4V。
2. API 立即返回任务 ID；线程池异步读取视频。
3. 按时间间隔抽取帧，在排除左右边缘和固定栏后转为灰度。
4. 对相邻帧进行纵向滑窗匹配，计算页面滚动位移。
5. 过滤动态地图/卡片重绘造成的孤立假位移。
6. 首帧保留顶部，每个后续帧只追加新露出的底部像素，末帧再保留一次固定底栏。
7. 浏览器轮询进度，完成后展示原图并提供 PNG 下载。

## API

- `POST /api/jobs`：上传视频并创建任务。
- `GET /api/jobs/{id}`：获取阶段、进度、尺寸和错误。
- `GET /api/jobs/{id}/image`：浏览器内预览 PNG。
- `GET /api/jobs/{id}/download`：下载带原视频文件名的长图。
- `GET /api/health`：健康检查。

## 参数

- `sample_interval`：抽帧间隔，默认 `0.20s`。越小越精细，但处理更慢。
- `content_top_ratio`：固定顶部占画面高度的比例，默认 `10.8%`。
- `content_bottom_ratio`：可拼接内容底线，默认 `83.3%`。

默认值针对 444×960 的竖屏手机录屏优化，也按比例适配其他分辨率。视频上若有更高的固定输入栏，可在 UI 中上调内容底线的裁切范围。

## 生产化建议

当前实现是可直接运行的单机产品。部署为多人服务时，建议把任务状态迁移到 Redis、文件放入对象存储、处理器切换为独立 worker，并在网关层补充登录、配额和病毒扫描。

## Railway 部署

仓库根目录包含生产用 `Dockerfile`。Railway 会在构建阶段编译 React 前端，再由 FastAPI 通过同一公网端口提供页面和 API。

1. 在 Railway 选择 **Deploy from GitHub repo**，连接本仓库。
2. 在服务设置中生成公网域名。
3. 如需跨重启保留任务文件，创建 Volume 并挂载到 `/data`。
4. 在服务设置中把 Healthcheck Path 设为 `/api/health`。

Railway 要求请求体在 5 分钟内上传完成。网络较慢时，大视频应压缩后再上传。
