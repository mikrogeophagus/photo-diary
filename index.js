'use strict';

const container = document.querySelector('#diaries');
const form = document.querySelector('form');

form.addEventListener('submit', addDiary);

const DATABASE_VERSION = 1;
const DATABASE_NAME = 'photo_diary';
const STORE_NAME = 'diaries';

/** @type {IDBDatabase | null} */
let database = null;

window.addEventListener('load', initialize);

function initialize() {
  const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

  request.addEventListener('upgradeneeded', (event) => {
    const database = event.target.result;
    database.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
  });

  request.addEventListener('success', (event) => {
    database = event.target.result;

    const transaction = database.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.openCursor(null, 'next');

    request.addEventListener('success', (event) => {
      const cursor = event.target.result;

      if (cursor) {
        displayDiary(cursor.value);
        cursor.continue();
      }
    });
  });
}

/**
 * @typedef {object} Diary - 日記
 * @property {number} [id] - 主キー
 * @property {File[]} photos - 写真
 * @property {string} text - テキスト
 * @property {number} createdAt - 作成日
 */

/**
 * 日記をデータベースに保存する
 * @param {SubmitEvent} event - submit イベント
 */
function addDiary(event) {
  event.preventDefault();

  const form = event.target;
  const formData = new FormData(form);

  /** @type {Diary} */
  const diary = {
    photos: formData.getAll('photos'),
    text: formData.get('text'),
    createdAt: Date.now()
  };

  const transaction = database.transaction(STORE_NAME, 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  const request = store.add(diary);

  request.addEventListener('success', (event) => {
    const key = event.target.result;
    diary.id = key;
  });

  transaction.addEventListener('complete', () => {
    displayDiary(diary);
  });

  transaction.addEventListener('abort', (event) => {
    if (event.target.error.name === 'QuotaExceededError') {
      alert('データベースの空き容量がないため、日記を保存できませんでした。');
    }
  });

  form.reset();
}

/**
 * 日記をデータベースとページから削除する
 * @param {string} primaryKey - 主キー
 */
function deleteDiary(primaryKey) {
  const column = document.querySelector(`[data-key="${primaryKey}"]`);

  const transaction = database.transaction(STORE_NAME, 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  store.delete(parseInt(primaryKey));

  transaction.addEventListener('complete', () => {
    column.remove();
  });
}

/**
 * 日記をページに表示する
 * @param {Diary} diary - 日記
 */
function displayDiary(diary) {
  const htmlString = `
    <div class="col" data-key="${diary.id}">
      <div class="card">
        <div id="carousel-${diary.id}" class="carousel slide" data-bs-ride="carousel">
          <div class="carousel-inner">
          ${diary.photos.map((photo, index) => `
            <div class="${index ? 'carousel-item' : 'carousel-item active'}" data-bs-interval="3000">
              <img src="${window.URL.createObjectURL(photo)}" onload="window.URL.revokeObjectURL(this.src);" class="d-block w-100" alt="${photo.name}">
            </div>
          `).join('\n')}
          </div>
          <button class="carousel-control-prev" type="button" data-bs-target="#carousel-${diary.id}" data-bs-slide="prev">
            <span class="carousel-control-prev-icon" aria-hidden="true"></span>
            <span class="visually-hidden">Previous</span>
          </button>
          <button class="carousel-control-next" type="button" data-bs-target="#carousel-${diary.id}" data-bs-slide="next">
            <span class="carousel-control-next-icon" aria-hidden="true"></span>
            <span class="visually-hidden">Next</span>
          </button>
        </div>
        <div class="card-body">
          <p class="card-text">${sanitize(diary.text)}</p>
          <div class="d-flex justify-content-between align-items-center">
            <button type="button" class="btn btn-sm btn-outline-danger" data-primary-key="${diary.id}" onclick="deleteDiary(this.dataset.primaryKey);">削除</button>
            <small class="text-muted">${new Date(diary.createdAt).toLocaleString({ timeZone: 'Asia/Tokyo' })}</small>
          </div>
        </div>
      </div>
    </div>
  `;

  container.insertAdjacentHTML('afterbegin', htmlString);
}

function sanitize(input) {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '$gt;')
    .replace(/&/g, '&amp;')
    .replace(/'/g, '&apos;')
    .replace(/"/g, '&quot;');
}