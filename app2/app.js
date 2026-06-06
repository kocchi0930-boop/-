// === デジタル御朱印帳 コアロジック ===

// アプリケーション状態
let state = {
  goshuinList: [],
  currentFilter: 'all',
  searchQuery: '',
  activeEditorTab: 'generated', // 'generated' | 'upload'
  uploadedPhotoBase64: '',
  editingId: null
};

const OMIKUJI_RESULTS = [
  {
    fortune: '大吉',
    wish: '心を澄ませば思うように進むでしょう',
    waiter: 'うれしい便りがほどなく届きます',
    lost: '身近な場所をもう一度探すと吉',
    travel: '遠方ほどよい出会いがあります',
    business: '焦らず整えれば利あり',
    study: '積み重ねがはっきり実ります'
  },
  {
    fortune: '中吉',
    wish: '一歩ずつ進めば叶いやすいでしょう',
    waiter: '少し遅れて訪れます',
    lost: '人に尋ねると手がかりあり',
    travel: '準備を丁寧にすれば吉',
    business: '見直しが利益につながります',
    study: '朝の時間に励むとよし'
  },
  {
    fortune: '小吉',
    wish: '欲張らず一つに絞るとよし',
    waiter: '静かに待てば知らせあり',
    lost: '急がず探せば見つかります',
    travel: '近場に楽しみがあります',
    business: '小さな改善が助けになります',
    study: '苦手を一つだけ片付けましょう'
  },
  {
    fortune: '吉',
    wish: '周囲への感謝が道を開きます',
    waiter: '思わぬ形で現れます',
    lost: '片付けの中に見つかるでしょう',
    travel: '予定通りで穏やかです',
    business: '誠実な対応で信頼を得ます',
    study: '復習に力を入れると吉'
  },
  {
    fortune: '末吉',
    wish: '今は種まきの時です',
    waiter: '急がず時を待ちましょう',
    lost: '忘れたころに出てきます',
    travel: '無理のない日程が吉',
    business: '守りを固めると安泰です',
    study: '基本に戻ると伸びます'
  }
];

// 漢数字変換マッピング
const KANJI_NUMBERS = {
  0: '〇', 1: '一', 2: '二', 3: '三', 4: '四',
  5: '五', 6: '六', 7: '七', 8: '八', 9: '九', 10: '十'
};

// 数字を漢数字に変換する関数 (月・日用)
function convertToKanjiNumber(num) {
  num = parseInt(num, 10);
  if (num <= 10) return KANJI_NUMBERS[num];
  if (num < 20) return '十' + (num % 10 !== 0 ? KANJI_NUMBERS[num % 10] : '');
  if (num < 30) return '二十' + (num % 10 !== 0 ? KANJI_NUMBERS[num % 10] : '');
  return '三十' + (num % 10 !== 0 ? KANJI_NUMBERS[num % 10] : '');
}

// 西暦年を漢数字に変換する関数
function convertYearToKanji(year) {
  return String(year).split('').map(digit => KANJI_NUMBERS[digit] || digit).join('');
}

// 日付 (YYYY-MM-DD) を和暦（令和）および和風表記に変換する関数
function getTraditionalJapaneseDate(dateStr) {
  if (!dateStr) return '';
  const [yearPart, monthPart, dayPart] = dateStr.split('-').map(Number);
  const date = new Date(yearPart, monthPart - 1, dayPart);
  if (isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  // 令和に変換 (2019年が令和元年)
  let eraYearStr = '';
  if (year >= 2019) {
    const eraYear = year - 2018;
    eraYearStr = eraYear === 1 ? '元' : convertToKanjiNumber(eraYear);
  } else if (year >= 1989) {
    // 平成 (1989年が平成元年)
    const eraYear = year - 1988;
    eraYearStr = '平成' + (eraYear === 1 ? '元' : convertToKanjiNumber(eraYear));
  } else {
    // それ以前は西暦を漢数字で表示
    return `二〇${convertYearToKanji(year % 100)}年 ${convertToKanjiNumber(month)}月${convertToKanjiNumber(day)}日`;
  }

  return `令和${eraYearStr}年 ${convertToKanjiNumber(month)}月${convertToKanjiNumber(day)}日`;
}

// 住所から都道府県名などを抽出して縦書き用に改行などを入れる
function formatLocationForVertical(location) {
  if (!location) return '';
  // 3〜4文字程度で折り返すか、都道府県名のみにするなど調整
  return location.substring(0, 15);
}

// === SVG 御朱印ジェネレーター ===
function renderGoshuinSVG(entry, forPreview = false) {
  const name = entry.name || '社寺名';
  const type = entry.type || 'shrine';
  const dateText = getTraditionalJapaneseDate(entry.date) || '令和八年 六月六日';
  const config = entry.generatedConfig || {
    stampShape: 'circle',
    stampText: '参拝',
    calligraphyText: name,
    calligraphyStyle: 'style-bold'
  };

  const stampShape = config.stampShape;
  const stampText = config.stampText || '参拝';
  
  // 書風クラスの適用
  let fontStyleAttr = 'font-weight: 700;';
  let fontOffset = 0;
  let fontScale = 1.0;
  let fontSkew = 0;

  if (config.calligraphyStyle === 'style-flowing') {
    fontStyleAttr = 'font-weight: 400; font-style: italic;';
    fontOffset = 3;
    fontScale = 0.95;
    fontSkew = -5;
  } else if (config.calligraphyStyle === 'style-traditional') {
    fontStyleAttr = 'font-weight: 500; letter-spacing: 2px;';
  }

  // 朱印スタンプの形状決定
  let stampElement = '';
  const stampColor = 'rgba(211, 56, 28, 0.88)'; // 朱肉風カラー
  
  // 文字数に応じた朱印内のテキスト配置
  let stampTextElements = '';
  const chars = stampText.split('').slice(0, 4);
  
  if (chars.length === 4) {
    // 伝統的な右上 -> 右下 -> 左上 -> 左下 の順で配置
    stampTextElements = `
      <text x="142" y="115" class="svg-stamp-text" style="fill: ${stampColor}; font-size: 13px;">${chars[0]}</text>
      <text x="142" y="138" class="svg-stamp-text" style="fill: ${stampColor}; font-size: 13px;">${chars[1]}</text>
      <text x="110" y="115" class="svg-stamp-text" style="fill: ${stampColor}; font-size: 13px;">${chars[2]}</text>
      <text x="110" y="138" class="svg-stamp-text" style="fill: ${stampColor}; font-size: 13px;">${chars[3]}</text>
    `;
  } else if (chars.length === 3) {
    // 上・中・下
    stampTextElements = `
      <text x="125" y="105" class="svg-stamp-text" style="fill: ${stampColor}; font-size: 13px;">${chars[0]}</text>
      <text x="125" y="125" class="svg-stamp-text" style="fill: ${stampColor}; font-size: 13px;">${chars[1]}</text>
      <text x="125" y="145" class="svg-stamp-text" style="fill: ${stampColor}; font-size: 13px;">${chars[2]}</text>
    `;
  } else if (chars.length === 2) {
    // 上・下
    stampTextElements = `
      <text x="125" y="112" class="svg-stamp-text" style="fill: ${stampColor}; font-size: 15px;">${chars[0]}</text>
      <text x="125" y="138" class="svg-stamp-text" style="fill: ${stampColor}; font-size: 15px;">${chars[1]}</text>
    `;
  } else {
    // 1文字（中央）
    stampTextElements = `
      <text x="125" y="125" class="svg-stamp-text" style="fill: ${stampColor}; font-size: 20px;">${chars[0] || '印'}</text>
    `;
  }

  // 形状の切り替え
  if (stampShape === 'circle') {
    stampElement = `
      <circle cx="125" cy="125" r="38" stroke="${stampColor}" stroke-width="3" fill="none" stroke-dasharray="200, 2" />
      <circle cx="125" cy="125" r="34" stroke="${stampColor}" stroke-width="1.2" fill="none" />
      ${stampTextElements}
    `;
  } else if (stampShape === 'square') {
    stampElement = `
      <rect x="88" y="88" width="74" height="74" rx="6" stroke="${stampColor}" stroke-width="3" fill="none" />
      <rect x="93" y="93" width="64" height="64" rx="3" stroke="${stampColor}" stroke-width="1" fill="none" />
      ${stampTextElements}
    `;
  } else if (stampShape === 'lotus') {
    // 蓮華（お寺用）のパス
    stampElement = `
      <path d="M125 80 C138 98 158 112 158 128 C158 148 140 158 125 168 C110 158 92 148 92 128 C92 112 112 98 125 80 Z" 
            stroke="${stampColor}" stroke-width="2.8" fill="none" />
      <path d="M125 95 C132 108 146 118 146 128 C146 140 135 148 125 156 C115 148 104 140 104 128 C104 118 118 108 125 95 Z" 
            stroke="${stampColor}" stroke-width="1" fill="none" opacity="0.7"/>
      ${stampTextElements}
    `;
  } else if (stampShape === 'torii') {
    // 鳥居（神社用）のパス
    stampElement = `
      <g stroke="${stampColor}" stroke-width="2.5" fill="none" stroke-linejoin="round" stroke-linecap="round">
        <!-- 鳥居枠 -->
        <path d="M 94 92 C 105 90, 145 90, 156 92" /> <!-- 笠木 -->
        <path d="M 96 99 L 154 99" /> <!-- 貫 -->
        <path d="M 107 99 L 107 156" /> <!-- 左柱 -->
        <path d="M 143 99 L 143 156" /> <!-- 右柱 -->
        <path d="M 125 99 L 125 110" stroke-width="1.5" /> <!-- 額束 -->
      </g>
      <!-- テキストは鳥居の下部に小さめに配置 -->
      <g transform="translate(0, 15)">
        ${stampTextElements}
      </g>
    `;
  }

  // 奉拝印（右上）の追加
  const miniStampElement = `
    <rect x="188" y="38" width="18" height="26" rx="2" stroke="${stampColor}" stroke-width="1.5" fill="none" transform="rotate(-5, 197, 51)" />
    <text x="197" y="48" style="font-family: var(--font-serif); font-size: 7px; fill: ${stampColor}; font-weight: 700; text-anchor: middle;">奉</text>
    <text x="197" y="57" style="font-family: var(--font-serif); font-size: 7px; fill: ${stampColor}; font-weight: 700; text-anchor: middle;">拝</text>
  `;

  // 書字アニメーション用クラス
  const animClass = forPreview ? '' : 'stamp-animation';

  // SVGの組み立て
  return `
    <svg viewBox="0 0 250 250" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="background-color: var(--washi-white); filter: url(#washi-paper-filter); box-shadow: inset 0 0 20px rgba(0,0,0,0.02);">
      <!-- Washi background overlay -->
      <rect width="250" height="250" fill="none" />
      
      <!-- 朱印（スタンプ） -->
      <g id="svg-stamps" class="${animClass}">
        ${stampElement}
        ${miniStampElement}
      </g>

      <!-- 揮毫（筆文字） -->
      <g id="svg-calligraphy" class="svg-calligraphy">
        <!-- 奉拝 (右上) -->
        <text x="202" y="75" style="font-size: 16px; writing-mode: vertical-rl; text-anchor: start; opacity: 0.95; font-family: var(--font-serif); ${fontStyleAttr}">奉拝</text>
        
        <!-- 神社仏閣名 (中央) -->
        <g transform="translate(${fontOffset}, 0) skewX(${fontSkew}) scale(${fontScale})">
          <text x="127" y="45" style="font-size: 26px; writing-mode: vertical-rl; text-anchor: start; font-family: var(--font-serif); ${fontStyleAttr}">${config.calligraphyText}</text>
        </g>
        
        <!-- 参拝日 (左) -->
        <text x="45" y="65" style="font-size: 11px; writing-mode: vertical-rl; text-anchor: start; opacity: 0.85; font-family: var(--font-serif);">${dateText}</text>
      </g>
    </svg>
  `;
}

// === 初期化とデータ読み込み ===
function initApp() {
  // localStorageから読み込み
  const stored = localStorage.getItem('goshuin_list');
  if (stored) {
    try {
      state.goshuinList = JSON.parse(stored);
    } catch (e) {
      console.error('データの解析に失敗しました。', e);
      state.goshuinList = [];
    }
  } else {
    state.goshuinList = [];
  }
  
  // 日付の初期値を今日に設定
  document.getElementById('input-date').valueAsDate = new Date();
  
  // イベントリスナーのセットアップ
  setupEventListeners();
  
  // リストの表示更新
  renderGoshuinGrid();
  updateStats();
  updateLivePreview();
}

// 統計情報の更新
function updateStats() {
  const total = state.goshuinList.length;
  const shrines = state.goshuinList.filter(item => item.type === 'shrine').length;
  const temples = state.goshuinList.filter(item => item.type === 'temple').length;
  
  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-shrines').textContent = shrines;
  document.getElementById('stat-temples').textContent = temples;
}

// 一覧のレンダリング
function renderGoshuinGrid() {
  const grid = document.getElementById('goshuin-grid');
  const emptyState = document.getElementById('empty-state');
  grid.innerHTML = '';
  
  // フィルター＆検索の適用
  const filtered = state.goshuinList.filter(item => {
    // 検索語
    const matchesSearch = state.searchQuery === '' || 
      item.name.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
      (item.location && item.location.toLowerCase().includes(state.searchQuery.toLowerCase())) ||
      (item.notes && item.notes.toLowerCase().includes(state.searchQuery.toLowerCase()));
      
    // タブフィルター
    const matchesTab = state.currentFilter === 'all' || item.type === state.currentFilter;
    
    return matchesSearch && matchesTab;
  });
  
  // 日付の新しい順（降順）でソート
  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

  if (filtered.length === 0) {
    grid.style.display = 'none';
    emptyState.style.display = 'block';
  } else {
    grid.style.display = 'grid';
    emptyState.style.display = 'none';
    
    filtered.forEach(entry => {
      const card = document.createElement('div');
      card.className = 'washi-card goshuin-card';
      card.setAttribute('data-id', entry.id);
      
      let stampHTML = '';
      if (entry.sourceType === 'generated' || entry.sourceType === 'generate') {
        stampHTML = renderGoshuinSVG(entry, true); // プレビュー用（アニメなし）
      } else {
        stampHTML = `<img src="${entry.photoUrl}" class="card-stamp-img" alt="${entry.name}">`;
      }
      
      const badgeText = entry.type === 'shrine' ? '神社 ⛩️' : '寺院 卍';
      const badgeClass = entry.type === 'shrine' ? 'shrine' : 'temple';
      
      // 日付の簡易フォーマット
      const displayDate = entry.date ? entry.date.replace(/-/g, '/') : '';
      
      card.innerHTML = `
        <div class="card-stamp-area">
          <div class="washi-texture"></div>
          <div class="card-stamp-preview">
            ${stampHTML}
          </div>
        </div>
        <div class="card-info">
          <span class="card-badge ${badgeClass}">${badgeText}</span>
          <h3 class="card-title">${entry.name}</h3>
          <div class="card-meta">
            <span>📍 ${entry.location || '所在地未設定'}</span>
            <span>${displayDate}</span>
          </div>
        </div>
      `;
      
      card.addEventListener('click', () => openDetailModal(entry.id));
      grid.appendChild(card);
    });
  }
}

// 編集画面のリアルタイムプレビュー更新
function updateLivePreview() {
  const container = document.getElementById('live-svg-container');
  
  if (state.activeEditorTab === 'generated') {
    // フォームに入力されている値を取得して一時的なオブジェクトを作成
    const tempEntry = {
      name: document.getElementById('input-name').value || '社寺名',
      type: document.getElementById('select-type').value,
      date: document.getElementById('input-date').value || new Date().toISOString().split('T')[0],
      location: document.getElementById('input-location').value,
      generatedConfig: {
        stampShape: document.getElementById('select-stamp-shape').value,
        stampText: document.getElementById('input-stamp-text').value || '参拝',
        calligraphyText: document.getElementById('input-name').value || '社寺名',
        calligraphyStyle: document.getElementById('select-calligraphy-style').value
      }
    };
    container.innerHTML = renderGoshuinSVG(tempEntry, true);
  } else {
    // 写真アップロードプレビュー
    if (state.uploadedPhotoBase64) {
      container.innerHTML = `<img src="${state.uploadedPhotoBase64}" style="width: 100%; height: 100%; object-fit: contain;">`;
    } else {
      container.innerHTML = `
        <div style="color: var(--sumi-light); text-align: center; padding: 1rem; font-size: 0.85rem;">
          📷 写真をアップロードするとここにプレビューが表示されます
        </div>
      `;
    }
  }
}

// === モーダル開閉制御 ===
function openEditorModal(id = null) {
  const modal = document.getElementById('modal-editor');
  const title = document.getElementById('editor-modal-title');
  const form = document.getElementById('form-goshuin');
  
  form.reset();
  state.uploadedPhotoBase64 = '';
  state.editingId = id;
  
  if (id) {
    // 編集モード
    title.textContent = '参拝記録の編集';
    const entry = state.goshuinList.find(item => item.id === id);
    if (entry) {
      document.getElementById('entry-id').value = entry.id;
      document.getElementById('input-name').value = entry.name;
      document.getElementById('select-type').value = entry.type;
      document.getElementById('input-date').value = entry.date;
      document.getElementById('input-location').value = entry.location;
      document.getElementById('input-notes').value = entry.notes;
      
      switchEditorTab(entry.sourceType === 'generate' ? 'generated' : entry.sourceType);
      
      if ((entry.sourceType === 'generated' || entry.sourceType === 'generate') && entry.generatedConfig) {
        document.getElementById('select-stamp-shape').value = entry.generatedConfig.stampShape;
        document.getElementById('input-stamp-text').value = entry.generatedConfig.stampText;
        document.getElementById('select-calligraphy-style').value = entry.generatedConfig.calligraphyStyle;
      } else if (entry.sourceType === 'photo' || entry.sourceType === 'upload') {
        state.uploadedPhotoBase64 = entry.photoUrl;
        const uploadPreview = document.getElementById('upload-preview-container');
        const uploadImg = document.getElementById('upload-preview-img');
        const dropzone = document.getElementById('upload-dropzone');
        
        uploadImg.src = entry.photoUrl;
        uploadPreview.style.display = 'block';
        dropzone.style.display = 'none';
      }
    }
  } else {
    // 新規追加モード
    title.textContent = '新たな参拝を記録';
    document.getElementById('entry-id').value = '';
    document.getElementById('input-date').valueAsDate = new Date();
    document.getElementById('input-stamp-text').value = '参拝';
    document.getElementById('upload-preview-container').style.display = 'none';
    document.getElementById('upload-dropzone').style.display = 'flex';
    
    switchEditorTab('generated');
  }
  
  modal.classList.add('active');
  updateLivePreview();
}

function closeEditorModal() {
  document.getElementById('modal-editor').classList.remove('active');
  state.editingId = null;
  state.uploadedPhotoBase64 = '';
}

function openDetailModal(id) {
  const entry = state.goshuinList.find(item => item.id === id);
  if (!entry) return;
  
  const modal = document.getElementById('modal-detail');
  const stampContent = document.getElementById('detail-stamp-content');
  const badge = document.getElementById('detail-badge');
  const name = document.getElementById('detail-name');
  const date = document.getElementById('detail-date');
  const location = document.getElementById('detail-location');
  const notes = document.getElementById('detail-notes');
  
  // 編集/削除用ID保持のため属性追加
  modal.setAttribute('data-active-id', id);
  
  // 御朱印の表示
  if (entry.sourceType === 'generated' || entry.sourceType === 'generate') {
    stampContent.innerHTML = renderGoshuinSVG(entry, false); // アニメーション付き
  } else {
    stampContent.innerHTML = `<img src="${entry.photoUrl}" style="max-width:100%; max-height:100%; object-fit:contain;" alt="${entry.name}">`;
  }
  
  // バッジ
  badge.textContent = entry.type === 'shrine' ? '神社 ⛩️' : '寺院 卍';
  badge.className = `card-badge ${entry.type === 'shrine' ? 'shrine' : 'temple'}`;
  
  // 文字列
  name.textContent = entry.name;
  date.textContent = getTraditionalJapaneseDate(entry.date) || entry.date;
  location.textContent = entry.location || '設定されていません';
  notes.textContent = entry.notes || '参拝メモはありません。';
  
  modal.classList.add('active');
}

function closeDetailModal() {
  document.getElementById('modal-detail').classList.remove('active');
}

// タブの切り替え
function switchEditorTab(tabName) {
  state.activeEditorTab = tabName;
  
  const tabGen = document.getElementById('tab-btn-generate');
  const tabUp = document.getElementById('tab-btn-upload');
  const configGen = document.getElementById('config-generate');
  const configUp = document.getElementById('config-upload');
  
  if (tabName === 'generated') {
    tabGen.classList.add('active');
    tabUp.classList.remove('active');
    configGen.classList.add('active');
    configUp.classList.remove('active');
  } else {
    tabGen.classList.remove('active');
    tabUp.classList.add('active');
    configGen.classList.remove('active');
    configUp.classList.add('active');
  }
  updateLivePreview();
}

// === 写真ファイルのBase64処理 ===
function processPhotoFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    alert('画像ファイルを選択してください。');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      // キャンバスを利用して画像を適切なサイズ（最大800px）にリサイズし、容量削減
      const canvas = document.createElement('canvas');
      const maxDim = 800;
      let width = img.width;
      let height = img.height;
      
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      
      state.uploadedPhotoBase64 = canvas.toDataURL('image/jpeg', 0.85);
      
      // UIの切り替え
      const uploadPreview = document.getElementById('upload-preview-container');
      const uploadImg = document.getElementById('upload-preview-img');
      const dropzone = document.getElementById('upload-dropzone');
      
      uploadImg.src = state.uploadedPhotoBase64;
      uploadPreview.style.display = 'block';
      dropzone.style.display = 'none';
      
      updateLivePreview();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// === データ永続化 (保存と読込) ===
function saveGoshuinEntry(e) {
  e.preventDefault();
  
  const id = document.getElementById('entry-id').value;
  const name = document.getElementById('input-name').value.trim();
  const type = document.getElementById('select-type').value;
  const date = document.getElementById('input-date').value;
  const location = document.getElementById('input-location').value.trim();
  const notes = document.getElementById('input-notes').value.trim();
  
  if (!name) {
    alert('神社仏閣名を入力してください。');
    return;
  }
  
  let entry = {
    id: id || 'goshuin_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    name: name,
    type: type,
    date: date,
    location: location,
    notes: notes,
    sourceType: state.activeEditorTab,
    createdAt: Date.now()
  };

  const existingEntry = state.goshuinList.find(item => item.id === entry.id);
  if (existingEntry && existingEntry.createdAt) {
    entry.createdAt = existingEntry.createdAt;
  }
  
  if (state.activeEditorTab === 'generated') {
    entry.generatedConfig = {
      stampShape: document.getElementById('select-stamp-shape').value,
      stampText: document.getElementById('input-stamp-text').value.trim() || '参拝',
      calligraphyText: name,
      calligraphyStyle: document.getElementById('select-calligraphy-style').value
    };
  } else {
    if (!state.uploadedPhotoBase64) {
      alert('写真をアップロードするか、または朱印デザイン作成タブを選択してください。');
      return;
    }
    entry.photoUrl = state.uploadedPhotoBase64;
  }
  
  // 新規または更新
  const index = state.goshuinList.findIndex(item => item.id === entry.id);
  if (index > -1) {
    state.goshuinList[index] = entry;
  } else {
    state.goshuinList.push(entry);
    
    // サティスファクション演出：登録成功時に軽い振動（スマホなど）
    if (navigator.vibrate) {
      navigator.vibrate(80);
    }
  }
  
  // localStorageに格納
  localStorage.setItem('goshuin_list', JSON.stringify(state.goshuinList));
  
  // UI更新
  renderGoshuinGrid();
  updateStats();
  closeEditorModal();
}

function deleteGoshuinEntry(id) {
  if (!confirm('この参拝記録を削除してもよろしいですか？取り消しはできません。')) {
    return;
  }
  
  state.goshuinList = state.goshuinList.filter(item => item.id !== id);
  localStorage.setItem('goshuin_list', JSON.stringify(state.goshuinList));
  
  renderGoshuinGrid();
  updateStats();
  closeDetailModal();
}

// === データバックアップ (JSON) ===
function exportData() {
  if (state.goshuinList.length === 0) {
    alert('エクスポートするデータがありません。');
    return;
  }
  
  const dataStr = JSON.stringify(state.goshuinList, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `goshuin_backup_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const list = JSON.parse(evt.target.result);
      if (!Array.isArray(list)) {
        throw new Error('データ形式が正しくありません。配列である必要があります。');
      }
      
      // 簡易検証
      const isValid = list.every(item => item.id && item.name && item.type && item.date);
      if (!isValid) {
        throw new Error('一部のデータに必要な情報（ID、社寺名、区分、日付）が欠けています。');
      }
      
      if (confirm(`読み込んだ ${list.length} 件の参拝記録を既存のデータに追加/上書きしますか？`)) {
        // 重複IDは上書き、新規は追加
        const listMap = new Map(state.goshuinList.map(item => [item.id, item]));
        list.forEach(item => listMap.set(item.id, item));
        
        state.goshuinList = Array.from(listMap.values());
        localStorage.setItem('goshuin_list', JSON.stringify(state.goshuinList));
        
        renderGoshuinGrid();
        updateStats();
        alert('データを読み込みました。');
      }
    } catch (err) {
      alert('インポートに失敗しました: ' + err.message);
    }
    // 入力値をリセットして同じファイルを再選択可能にする
    e.target.value = '';
  };
  reader.readAsText(file);
}

// === おみくじ ===
function resetOmikujiView() {
  document.getElementById('omikuji-box-area').style.display = 'flex';
  document.getElementById('omikuji-result-area').style.display = 'none';
  document.getElementById('omikuji-box').classList.remove('shake-animation');
  document.getElementById('omikuji-stick').classList.remove('stick-pop');
  document.getElementById('omikuji-slip').classList.remove('slip-reveal');
}

function openOmikujiModal() {
  resetOmikujiView();
  document.getElementById('modal-omikuji').classList.add('active');
}

function closeOmikujiModal() {
  document.getElementById('modal-omikuji').classList.remove('active');
}

function drawOmikuji() {
  const box = document.getElementById('omikuji-box');
  const stick = document.getElementById('omikuji-stick');
  const slip = document.getElementById('omikuji-slip');
  const result = OMIKUJI_RESULTS[Math.floor(Math.random() * OMIKUJI_RESULTS.length)];

  box.classList.remove('shake-animation');
  stick.classList.remove('stick-pop');
  slip.classList.remove('slip-reveal');
  void box.offsetWidth;

  box.classList.add('shake-animation');
  stick.classList.add('stick-pop');

  window.setTimeout(() => {
    document.getElementById('slip-fortune-val').textContent = result.fortune;
    document.getElementById('slip-wish').textContent = result.wish;
    document.getElementById('slip-waiter').textContent = result.waiter;
    document.getElementById('slip-lost').textContent = result.lost;
    document.getElementById('slip-travel').textContent = result.travel;
    document.getElementById('slip-business').textContent = result.business;
    document.getElementById('slip-study').textContent = result.study;
    document.getElementById('omikuji-date-label').textContent = new Date().toLocaleDateString('ja-JP', {
      era: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    document.getElementById('omikuji-box-area').style.display = 'none';
    document.getElementById('omikuji-result-area').style.display = 'flex';
    slip.classList.add('slip-reveal');
  }, 620);
}

// === イベントリスナー ===
function setupEventListeners() {
  // 新規ボタン
  document.getElementById('btn-add-goshuin').addEventListener('click', () => openEditorModal());
  document.getElementById('btn-empty-add').addEventListener('click', () => openEditorModal());
  
  // 閉じる・キャンセルボタン
  document.getElementById('btn-close-editor').addEventListener('click', closeEditorModal);
  document.getElementById('btn-cancel-editor').addEventListener('click', closeEditorModal);
  document.getElementById('btn-close-detail').addEventListener('click', closeDetailModal);
  document.getElementById('btn-close-omikuji').addEventListener('click', closeOmikujiModal);
  
  // 保存
  document.getElementById('form-goshuin').addEventListener('submit', saveGoshuinEntry);
  
  // 編集モードタブ切り替え
  document.getElementById('tab-btn-generate').addEventListener('click', () => switchEditorTab('generated'));
  document.getElementById('tab-btn-upload').addEventListener('click', () => switchEditorTab('upload'));
  
  // リアルタイムプレビュー用インプット監視
  const watchInputs = ['input-name', 'select-type', 'input-date', 'input-location', 'select-stamp-shape', 'input-stamp-text', 'select-calligraphy-style'];
  watchInputs.forEach(id => {
    document.getElementById(id).addEventListener('input', updateLivePreview);
  });
  
  // 写真アップロードのトリガー
  const dropzone = document.getElementById('upload-dropzone');
  const fileInput = document.getElementById('file-photo-input');
  
  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => processPhotoFile(e.target.files[0]));
  
  // ドラッグ＆ドロップ
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.style.borderColor = 'var(--vermilion)';
    dropzone.style.background = 'var(--vermilion-light)';
  });
  
  dropzone.addEventListener('dragleave', () => {
    dropzone.style.borderColor = 'rgba(197, 160, 89, 0.4)';
    dropzone.style.background = 'var(--washi-white)';
  });
  
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.style.borderColor = 'rgba(197, 160, 89, 0.4)';
    dropzone.style.background = 'var(--washi-white)';
    if (e.dataTransfer.files.length > 0) {
      processPhotoFile(e.dataTransfer.files[0]);
    }
  });
  
  // アップロード写真削除
  document.getElementById('btn-remove-photo').addEventListener('click', () => {
    state.uploadedPhotoBase64 = '';
    document.getElementById('upload-preview-container').style.display = 'none';
    document.getElementById('upload-dropzone').style.display = 'flex';
    updateLivePreview();
  });
  
  // 検索とフィルター
  document.getElementById('search-input').addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderGoshuinGrid();
  });
  
  const filterTabs = document.getElementById('filter-tabs');
  filterTabs.addEventListener('click', (e) => {
    if (e.target.classList.contains('filter-tab')) {
      // アクティブ切り替え
      filterTabs.querySelectorAll('.filter-tab').forEach(btn => btn.classList.remove('active'));
      e.target.classList.add('active');
      
      state.currentFilter = e.target.getAttribute('data-type');
      renderGoshuinGrid();
    }
  });
  
  // 詳細画面からの編集・削除
  document.getElementById('btn-edit-entry').addEventListener('click', () => {
    const id = document.getElementById('modal-detail').getAttribute('data-active-id');
    closeDetailModal();
    openEditorModal(id);
  });
  
  document.getElementById('btn-delete-entry').addEventListener('click', () => {
    const id = document.getElementById('modal-detail').getAttribute('data-active-id');
    deleteGoshuinEntry(id);
  });
  
  // エクスポート・インポート
  document.getElementById('btn-export-data').addEventListener('click', exportData);
  
  const importTrigger = document.getElementById('btn-import-trigger');
  const importFile = document.getElementById('file-import-data');
  importTrigger.addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', importData);

  // おみくじ
  document.getElementById('btn-omikuji').addEventListener('click', openOmikujiModal);
  document.getElementById('btn-shake-box').addEventListener('click', drawOmikuji);
  document.getElementById('btn-pull-again').addEventListener('click', resetOmikujiView);
}

// 起動
window.addEventListener('DOMContentLoaded', initApp);
