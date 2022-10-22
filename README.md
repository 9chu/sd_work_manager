# sd-work-manager

`Stable diffusion` 模型计算工作管理节点。

需要配合 [sd-work-node](https://github.com/9chu/sd_work_node) 使用。

## 启动

```bash
git clone https://github.com/9chu/sd_work_manager
cd sd_work_manager
npm i
npm run build && npm run start
```

### 参考配置文件

```json
{
  "webApiListenHost": "0.0.0.0",
  "webApiListenPort": 17059,
  "webApiSecret": "qwert12345",
  "storageDBUrl": "sqlite::memory:"
}
```

| 配置项            | 说明                |
| ---------------- | ------------------ |
| webApiListenHost | 监听地址             |
| webApiListenPort | 监听端口             |
| webApiSecret     | 服务间通信所用鉴权密钥 |
| storageDBUrl     | 后端数据库 URL       |

## HTTP API

当启动后，服务对外以 HTTP API 形式提供访问。

所有请求以`POST`方式进行，并且需要携带`X-API-SECRET`头进行鉴权（对应`webApiSecret`配置项）。

需要注意，本服务因为是对内使用，故参数均未进行严格校验，请确保服务上游做好相应检查。

### /api/Task/submitTxt2ImgTask

提交一个文本转图像任务。

示例请求：

```json
{
    "width": 256,
    "height": 256,
    "prompts": "loli",
    "negativePrompts": "deformed,lowres,deformed,bad anatomy,disfigured,poorly drawn face,mutation,mutated,extra limb,ugly,poorly drawn hands,missing limb,floating limbs,disconnected limbs,malformed hands,out of focus,big boobs,long neck,long body,monochrome,signature,watermark,text",
    "count": 1,
    "steps": 20,
    "scale": 8,
    "comment": "test"
}
```

### /api/Task/submitImg2ImgTask

提交一个图像转图像任务。

示例请求：

```json
{
    "width": 512,
    "height": 512,
    "prompts": "loli",
    "initialImages": [
        "BASE64 ENCODED"
    ],
    "negativePrompts": "deformed,lowres,deformed,bad anatomy,disfigured,poorly drawn face,mutation,mutated,extra limb,ugly,poorly drawn hands,missing limb,floating limbs,disconnected limbs,malformed hands,out of focus,big boobs,long neck,long body,monochrome,signature,watermark,text",
    "steps": 20,
    "scale": 8,
    "denoise": 0.8,
    "resizeMode": 2,
    "module": "furry",
    "comment": "test"
}
```

### /api/Task/submitUpscaleTask

提交一个上采样任务。

示例请求：

```json
{
    "image": "BASE64 ENCODED",
    "scale": 4
}
```

### /api/Task/getTaskState

获取任务状态。

示例请求：

```json
{
    "taskId": 1
}
```

## 许可

MIT License.
