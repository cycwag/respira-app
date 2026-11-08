'use client';

import { useState, useEffect, useRef } from 'react';
import { fetchIspaNews, fetchArticleDetail } from '@/lib/api';

export default function NewsModal({ isOpen, onClose }) {
  const [articles, setArticles] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const modalBodyRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      setSelectedArticle(null);
      return;
    }

    let isMounted = true;
    async function loadNews() {
      setLoadingList(true);
      setErrorMsg('');
      try {
        const res = await fetchIspaNews(8);
        if (isMounted) {
          setArticles(res.articles || []);
        }
      } catch (err) {
        if (isMounted) {
          setErrorMsg('Gagal memuat berita terkini. Periksa koneksi backend.');
        }
      } finally {
        if (isMounted) {
          setLoadingList(false);
        }
      }
    }

    loadNews();
    return () => { isMounted = false; };
  }, [isOpen]);

  useEffect(() => {
    if (modalBodyRef.current) {
      modalBodyRef.current.scrollTop = 0;
    }
  }, [selectedArticle]);

  async function handleSelectArticle(art) {
    setLoadingDetail(true);
    const chosenThumbnail = art.thumbnail;
    setSelectedArticle({ ...art, thumbnail: chosenThumbnail, paragraphs: [] });

    try {
      const res = await fetchArticleDetail(art.url);
      if (res && res.article) {
        setSelectedArticle({
          ...res.article,
          // Gunakan thumbnail yang konsisten agar gambar tidak berganti mendadak
          thumbnail: chosenThumbnail || res.article.thumbnail
        });
      }
    } catch (e) {
      console.warn('Gagal load detail lengkap:', e);
      // Fallback ke data list
      setSelectedArticle({
        title: art.title,
        author: 'Redaksi Kesehatan',
        date: art.date || 'Terbaru',
        thumbnail: chosenThumbnail,
        url: art.url,
        paragraphs: [
          art.description || 'Klik tombol di bawah untuk membaca artikel selengkapnya di portal sumber asli.'
        ]
      });
    } finally {
      setLoadingDetail(false);
    }
  }

  function getSafeUrl(url) {
    if (typeof url === 'string' && /^https?:\/\//i.test(url.trim())) {
      return url.trim();
    }
    return '#';
  }

  function getSafeImg(src) {
    if (typeof src === 'string' && (/^https?:\/\//i.test(src.trim()) || src.trim().startsWith('/'))) {
      return src.trim();
    }
    return 'https://images.unsplash.com/photo-1584634731339-252c581abfc5?w=500&q=80';
  }

  if (!isOpen) return null;

  return (
    <div className="news-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="news-modal-container" onClick={(e) => e.stopPropagation()}>
        
        {/* Header Modal */}
        <div className="news-modal-header">
          <div className="news-modal-title-wrap">
            <span className="news-badge-live">LIVE NEWS FEED</span>
            <h3>{selectedArticle ? 'Reader View' : 'Berita Terkini Mengenai ISPA & Kualitas Udara'}</h3>
          </div>
          <button type="button" className="news-modal-close" onClick={onClose} aria-label="Tutup">
            ✕
          </button>
        </div>

        {/* Konten Modal: Detail Reader View atau Daftar List Berita */}
        <div className="news-modal-body" ref={modalBodyRef}>
          {selectedArticle ? (
            <div className="article-reader-view">
              <button 
                type="button" 
                className="btn-back-to-list"
                onClick={() => setSelectedArticle(null)}
              >
                ← Kembali ke Daftar Berita
              </button>

              <h2 className="reader-title">{selectedArticle.title}</h2>

              <div className="reader-meta-bar">
                <span className="meta-item">Penulis: <strong>{selectedArticle.author || 'Redaksi'}</strong></span>
                <span className="meta-separator">•</span>
                <span className="meta-item">📅 {selectedArticle.date}</span>
              </div>

              {selectedArticle.thumbnail && (
                <div className="reader-image-wrap">
                  <img src={getSafeImg(selectedArticle.thumbnail)} alt={selectedArticle.title} className="reader-cover-img" />
                </div>
              )}

              {loadingDetail ? (
                <div className="reader-loading">
                  <div className="spinner-dots"></div>
                  <span>Memuat isi lengkap artikel...</span>
                </div>
              ) : (
                <div className="reader-paragraphs">
                  {selectedArticle.paragraphs && selectedArticle.paragraphs.length > 0 ? (
                    selectedArticle.paragraphs.map((p, idx) => (
                      <p key={idx} className="reader-p">{p}</p>
                    ))
                  ) : (
                    <p className="reader-p">{selectedArticle.description}</p>
                  )}
                </div>
              )}

              <div className="reader-footer-actions">
                <a 
                  href={getSafeUrl(selectedArticle.url)} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="btn-open-original"
                >
                  <span>Buka di Sumber Asli ↗</span>
                </a>
              </div>
            </div>
          ) : (
            <div className="news-list-view">
              {loadingList ? (
                <div className="news-loading-state">
                  <div className="spinner-dots"></div>
                  <span>Mengambil kurasi berita ISPA terkini...</span>
                </div>
              ) : errorMsg ? (
                <div className="news-error-state">
                  <p>{errorMsg}</p>
                </div>
              ) : articles.length === 0 ? (
                <div className="news-empty-state">
                  <p>Belum ada berita yang tersedia saat ini.</p>
                </div>
              ) : (
                <div className="news-cards-grid">
                  {articles.map((art) => (
                    <div 
                      key={art.id} 
                      className="news-card-item"
                      onClick={() => handleSelectArticle(art)}
                    >
                      <div className="news-thumb-wrap">
                        <img src={getSafeImg(art.thumbnail)} alt={art.title} className="news-card-thumb" />
                        <span className="news-source-tag">{art.source}</span>
                      </div>
                      <div className="news-card-content">
                        <h4 className="news-card-title">{art.title}</h4>
                        <p className="news-card-desc">{art.description}</p>
                        <div className="news-card-footer">
                          <span className="news-date-text">{art.date}</span>
                          <span className="news-read-cta">Baca →</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
