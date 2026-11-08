const MAX_CACHE_ENTRIES = 100;

const cache = {
  list: null,
  listExpires: 0,
  details: new Map() // url -> { data, expires }
};

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 menit
const DETAIL_CACHE_TTL_MS = 60 * 60 * 1000; // 1 jam
const MAX_PAYLOAD_SIZE = 512 * 1024; // 512KB max string size for regex parsing

const FALLBACK_ARTICLES = [
  {
    id: 'fallback_1',
    title: 'Kasus ISPA di DKI Jakarta Meningkat Saat Musim Hujan, Warga Diimbau Pakai Masker',
    url: 'https://health.detik.com/berita-detikhealth/ispa-jakarta-musim-hujan',
    thumbnail: 'https://images.unsplash.com/photo-1584634731339-252c581abfc5?w=600&q=80',
    source: 'Kemenkes RI & Dinkes DKI',
    description: 'Dinas Kesehatan DKI Jakarta mencatat fluktuasi kasus infeksi saluran pernapasan akut seiring peningkatan kelembapan dan konsentrasi partikel polutan halus PM2.5.',
    date: 'Hari ini',
    author: 'Tim Redaksi Kesehatan',
    paragraphs: [
      'Dinas Kesehatan Provinsi DKI Jakarta mengimbau seluruh masyarakat untuk meningkatkan kewaspadaan terhadap penularan Infeksi Saluran Pernapasan Akut (ISPA). Pergantian cuaca dan kelembapan udara yang tinggi memicu percepatan perkembangbiakan patogen di saluran napas.',
      'Kelompok rentan seperti balita, lansia, dan individu dengan riwayat penyakit ginjal serta hati kronis disarankan untuk membatasi aktivitas di luar ruangan saat kadar polutan PM2.5 berada di atas ambang batas aman.',
      'Langkah preventif utama yang dianjurkan mencakup penggunaan masker medis atau respirator KF94/KN95, menjaga sirkulasi udara bersih di rumah, serta mencukupi kebutuhan hidrasi cairan hangat minimal 2 liter per hari.'
    ]
  },
  {
    id: 'fallback_2',
    title: 'Waspada Partikel PM2.5 Pemicu Iritasi Mukosa Saluran Pernapasan',
    url: 'https://health.detik.com/berita-detikhealth/bahaya-pm25-saluran-napas',
    thumbnail: 'https://images.unsplash.com/photo-1611273426858-450d8e3c9fce?w=600&q=80',
    source: 'Pusat Riset Paru Nasional',
    description: 'Partikel halus berukuran 2.5 mikrometer mampu menembus filtrasi bulu hidung dan bersarang di bronkiolus, meningkatkan risiko penyakit J00, J02, dan J06.',
    date: 'Kemarin',
    author: 'Spesialis Paru & Saluran Napas',
    paragraphs: [
      'Partikulat PM2.5 merupakan salah satu polutan udara paling berbahaya bagi sistem pernapasan manusia. Ukurannya yang mikroskopis memungkinkan partikel ini melewati silia saluran napas atas dan langsung menuju alveolus.',
      'Paparan kronis dapat melumpuhkan gerak rambut getar (silia) pada bronkus, terutama bagi perokok aktif yang memiliki Odds Ratio kerentanan 1.25 kali lebih tinggi terkena radang saluran napas akut.',
      'Penggunaan air purifier berfilter HEPA dan pemantauan indeks kualitas udara secara berkala menjadi perlindungan penting bagi warga kawasan urban padat.'
    ]
  }
];

function decodeHtmlEntities(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .slice(0, 1000)
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pruneCache(map, max = MAX_CACHE_ENTRIES) {
  if (map.size > max) {
    const firstKey = map.keys().next().value;
    map.delete(firstKey);
  }
}

/**
 * Validasi ketat SSRF: Pastikan URL adalah HTTP/HTTPS publik dan dari domain berita terpercaya
 */
function validateNewsUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    if (parsed.username || parsed.password) return false;
    if (parsed.port && parsed.port !== '80' && parsed.port !== '443') return false;

    const hostname = parsed.hostname.toLowerCase();

    // Blokir localhost dan loopback / link-local / IP address internal
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname === '[::1]' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
      /^169\.254\./.test(hostname)
    ) {
      return false;
    }

    // Whitelist domain berita terpercaya
    const ALLOWED_DOMAINS = ['detik.com', 'cnnindonesia.com', 'kompas.com', 'antaranews.com'];
    const isAllowed = ALLOWED_DOMAINS.some(domain => hostname === domain || hostname.endsWith('.' + domain));
    return isAllowed;
  } catch {
    return false;
  }
}

/**
 * Mengambil daftar berita ISPA & Polusi terkini dari portal berita nasional
 */
async function getIspaNewsList(limit = 8) {
  const safeLimit = Math.min(20, Math.max(1, parseInt(limit, 10) || 8));
  const now = Date.now();
  if (cache.list && cache.listExpires > now) {
    return cache.list.slice(0, safeLimit);
  }

  const searchUrl = 'https://www.detik.com/search/searchall?query=ispa+jakarta';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'id,en;q=0.9'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`HTTP error: ${res.status}`);

    const rawHtml = await res.text();
    // Potong maksimal 512KB untuk proteksi ReDoS & memory bloat
    const html = rawHtml.length > MAX_PAYLOAD_SIZE ? rawHtml.slice(0, MAX_PAYLOAD_SIZE) : rawHtml;
    const articleBlocks = html.match(/<article[\s\S]*?<\/article>/gi) || [];

    const articles = [];
    for (let i = 0; i < articleBlocks.length && articles.length < safeLimit; i++) {
      const art = articleBlocks[i];
      const titleMatch = art.match(/<h3 class=["']media__title["'][^>]*>[\s\S]*?<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
      const imgMatch = art.match(/<img[^>]+src=["']([^"']+)["']/i);
      const sourceMatch = art.match(/<h2 class=["']media__subtitle["'][^>]*>([\s\S]*?)<\/h2>/i);
      const descMatch = art.match(/<div class=["']media__desc["'][^>]*>([\s\S]*?)<\/div>/i);
      const dateMatch = art.match(/<div class=["']media__date["'][^>]*>[\s\S]*?<span[^>]+title=["']([^"']+)["']/i) ||
                        art.match(/<div class=["']media__date["'][^>]*>[\s\S]*?<span>([\s\S]*?)<\/span>/i);

      if (titleMatch && titleMatch[1]) {
        const articleUrl = titleMatch[1];
        
        // Filter out non-text articles & validasi URL
        if (!validateNewsUrl(articleUrl)) {
          continue;
        }

        const isNonArticle = articleUrl.includes('/foto') ||
                             articleUrl.includes('/galeri') ||
                             articleUrl.includes('/video') ||
                             articleUrl.includes('20detik') ||
                             articleUrl.includes('/infografis');
        if (isNonArticle) {
          continue;
        }

        const rawTitle = titleMatch[2].replace(/<[^>]+>/g, '');
        const cleanTitle = decodeHtmlEntities(rawTitle);
        const cleanDesc = decodeHtmlEntities(descMatch ? descMatch[1] : '');
        const cleanDate = decodeHtmlEntities(dateMatch ? (dateMatch[1] || dateMatch[2]) : '');
        const cleanSource = decodeHtmlEntities(sourceMatch ? sourceMatch[1] : 'detikNews');

        const cleanThumbnail = imgMatch && /^https?:\/\//i.test(imgMatch[1])
          ? imgMatch[1]
          : 'https://images.unsplash.com/photo-1584634731339-252c581abfc5?w=500&q=80';

        articles.push({
          id: `news_${articles.length + 1}`,
          title: cleanTitle,
          url: articleUrl,
          thumbnail: cleanThumbnail,
          source: cleanSource,
          description: cleanDesc,
          date: cleanDate
        });
      }
    }

    if (articles.length === 0) {
      return FALLBACK_ARTICLES.slice(0, safeLimit);
    }

    cache.list = articles;
    cache.listExpires = now + CACHE_TTL_MS;
    return articles;
  } catch (err) {
    console.warn('Gagal fetch live scraper berita, memakai fallback:', err.message);
    return FALLBACK_ARTICLES.slice(0, safeLimit);
  }
}

/**
 * Mengambil detail konten artikel: Author, Foto Utama, Tanggal, & Paragraf Berita
 */
async function getArticleDetail(url) {
  if (!url || typeof url !== 'string') return null;

  // SSRF guard check
  if (!validateNewsUrl(url)) {
    throw new Error('URL artikel tidak diizinkan atau tidak valid.');
  }

  const now = Date.now();
  const cached = cache.details.get(url);
  if (cached && cached.expires > now) {
    return cached.data;
  }

  // Jika URL fallback, kembalikan data fallback langsung
  const fb = FALLBACK_ARTICLES.find(f => f.url === url);
  if (fb) return fb;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'id,en;q=0.9'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`HTTP error: ${res.status}`);

    const rawHtml = await res.text();
    const html = rawHtml.length > MAX_PAYLOAD_SIZE ? rawHtml.slice(0, MAX_PAYLOAD_SIZE) : rawHtml;

    // 1. Title
    const titleMatch = html.match(/<h1 class=["']detail__title["'][^>]*>([\s\S]*?)<\/h1>/i) ||
                       html.match(/<title>([\s\S]*?)<\/title>/i);
    const title = decodeHtmlEntities(titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '') : 'Berita ISPA');

    // 2. Author
    const authorMatch = html.match(/class=["']detail__author["'][^>]*>([\s\S]*?)<\/div>/i) ||
                        html.match(/<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)["']/i);
    const author = decodeHtmlEntities(authorMatch ? authorMatch[1].replace(/<[^>]+>/g, '') : 'Redaksi Kesehatan');

    // 3. Date
    const dateMatch = html.match(/class=["']detail__date["'][^>]*>([\s\S]*?)<\/div>/i) ||
                      html.match(/<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i);
    const date = decodeHtmlEntities(dateMatch ? dateMatch[1].replace(/<[^>]+>/g, '') : 'Terbaru');

    // 4. Main Lead Image
    const imgMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
                     html.match(/class=["']detail__media-image["'][^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i);
    const thumbnail = imgMatch && /^https?:\/\//i.test(imgMatch[1])
      ? imgMatch[1]
      : 'https://images.unsplash.com/photo-1584634731339-252c581abfc5?w=800&q=80';

    // 5. Clean Article Body Paragraphs
    const bodyMatch = html.match(/class=["']detail__body-text[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    let paragraphs = [];
    if (bodyMatch) {
      paragraphs = [...bodyMatch[1].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
        .map(m => decodeHtmlEntities(m[1].replace(/<[^>]+>/g, '')))
        .filter(p => {
          const lower = p.toLowerCase();
          return p.length > 25 &&
                 !lower.includes('baca juga') &&
                 !lower.includes('simak video') &&
                 !lower.includes('tonton juga') &&
                 !lower.includes('halaman selanjutnya');
        })
        .slice(0, 20); // Maksimal 20 paragraf
    }

    if (paragraphs.length === 0) {
      paragraphs = [
        'Informasi lengkap mengenai perkembangan kasus infeksi saluran pernapasan akut dan kondisi polusi udara dapat dibaca langsung pada tautan portal penerbit.',
        'Kementerian Kesehatan dan Dinas Kesehatan senantiasa menganjurkan masyarakat untuk menerapkan protokol kesehatan pernapasan saat indeks partikulat halus meningkat.'
      ];
    }

    const result = {
      title,
      author,
      date,
      thumbnail,
      url,
      paragraphs
    };

    pruneCache(cache.details);
    cache.details.set(url, { data: result, expires: now + DETAIL_CACHE_TTL_MS });
    return result;
  } catch (err) {
    console.warn('Gagal scrape detail artikel, fallback ke ringkasan:', err.message);
    if (err.message.includes('tidak diizinkan')) {
      throw err;
    }
    return {
      title: 'Artikel Kesehatan ISPA',
      author: 'Redaksi Kesehatan',
      date: 'Terbaru',
      thumbnail: 'https://images.unsplash.com/photo-1584634731339-252c581abfc5?w=800&q=80',
      url,
      paragraphs: [
        'Artikel ini membahas perkembangan kondisi ISPA dan kualitas udara di wilayah perkotaan.',
        'Klik tombol sumber asli untuk membaca artikel selengkapnya di portal penerbit.'
      ]
    };
  }
}

module.exports = {
  getIspaNewsList,
  getArticleDetail,
  validateNewsUrl
};
