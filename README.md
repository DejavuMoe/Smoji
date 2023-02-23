<div align=center>
<h1>
Smoji 🫣
</div>

<div align=center>
<strong>Smoji = Social + Emoji</strong>
</div>

## Introduction

Smoji is an emoji project that includes many default emoji packs built into applications, itl also include some funny little emojis. 😎

You can use these emoji packs on your Mastodon,  Pleroma,  Misskey, and other federated social applications, as well as on your website and comment systems. 😉

You can browse in **Playground** https://smoji.dejavu.moe and take a look. 👀

| Name        | Description   |
| ----------- | ------------- |
| weibo       | 新浪微博      |
| coolapk     | 酷安社区      |
| bilibili    | 哔哩哔哩      |
| qq          | 腾讯 QQ       |
| eveonecat   | Every One Cat |
| wechat      | 微信          |
| xiaodianshi | 小电视        |
| ding        | 钉钉          |

## Usage

### Mastodon

You can check the use of Mastodon import emoji on the [Releases](https://github.com/DejavuMoe/Smoji/releases) Page, for example:

```bash
wget https://github.com/DejavuMoe/Smoji/releases/download/2023.02.20/coolapk.tar.gz
wget https://github.com/DejavuMoe/Smoji/releases/download/2023.02.20/weibo.tar.gz

sudo mv coolapk.tar.gz mastodon/public/system/coolapk.tar.gz
sudo mv weibo.tar.gz mastodon/public/system/weibo.tar.gz


sudo docker exec mastodon-web tootctl emoji import --category weibo /mastodon/public/system/weibo.tar.gz
sudo docker exec mastodon-web tootctl emoji import --category coolapk /mastodon/public/system/coolapk.tar.gz
```

### Pleroma

On your pleroma server, pull the latest source code for the master branch, and then import it in the backend on a per-file shelf

### OwO

We provide an out of the box [OwO](https://github.com/DIYgod/OwO) format, which means you can use it directly on the OwO-compatible emoji system. Here are some links to their documentation, please enjoy 🤤

```
https://smoji.dejavu.moe/Smoji.json
```

- **[Artalk](https://artalk.js.org/guide/frontend/emoticons.html#owo-格式)**
- **[Typecho Theme](https://www.google.com.hk/search?q=Typecho+OwO%E8%A1%A8%E6%83%85&pws=0&gl=us)**
- ……

---

**Attention:** emoji collected by Smoji is only for learning and communication. The original author of the emoji is copyrighted. Please do not use them for any commercial purpose.

