import axios from "axios";

const REQUEST_TIMEOUT_MS = 30_000;

export default class BagahAPI {
  #baseUrl;
  #apiKey;

  constructor(baseUrl, apiKey) {
    this.#baseUrl = baseUrl.replace(/\/+$/, "");
    this.#apiKey = apiKey;
  }

  async #request(endpoint, params = {}) {
    if (!this.#apiKey) {
      throw new Error("API_KEY belum dikonfigurasi di .env");
    }

    const { data } = await axios.get(`${this.#baseUrl}${endpoint}`, {
      params,
      headers: { "x-api-key": this.#apiKey },
      timeout: REQUEST_TIMEOUT_MS,
    });

    if (!data.success) {
      throw new Error(data.message || "API request failed");
    }

    return data.data;
  }

  async facebookDownload(url) {
    const result = await this.#request("/api/facebook-downloader-s2", { url });
    const best =
      result.results?.find((item) => /hd|720/i.test(item.quality)) ||
      result.results?.[0];

    return {
      description: result.description,
      url: best?.url,
      quality: best?.quality,
    };
  }

  async instagramDownload(url) {
    const results = await this.#request("/api/instagram-downloader-s2", {
      url,
    });

    if (!Array.isArray(results) || !results.length) {
      throw new Error("Tidak ada media ditemukan");
    }

    return results.map((item) => ({
      type: item.type,
      url: item.url,
    }));
  }

  async igStory(username) {
    const result = await this.#request("/api/igstory", { username });

    return {
      user: {
        username: result.user?.username,
        fullName: result.user?.fullName,
        followers: result.user?.followers,
        following: result.user?.following,
        posts: result.user?.posts,
      },
      stories: (result.url || []).map((item) => ({
        type: item.type,
        url: item.url,
      })),
    };
  }

  async tiktokStalk(username) {
    const result = await this.#request("/api/tiktokstalk", { username });

    return {
      avatar: result.avatar,
      following: result.following,
      followers: result.followers,
      likes: result.likes,
    };
  }
}
