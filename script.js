// --- 1. 地図の初期化 ---
const map = L.map('map').setView([36.2048, 138.2529], 5);

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 19
}).addTo(map);

// --- 都道府県 GeoJSON を読み込んで海と陸地を描画 ---
fetch('./prefectures.geojson')
    .then(r => {
        if (!r.ok) throw new Error('prefectures.geojson not found');
        return r.json();
    })
    .then(geo => {
        // 専用の pane を作り順序を制御（海 -> 都道府県 -> タイルより手前）
        if (!map.getPane('seaPane')) map.createPane('seaPane');
        if (!map.getPane('prefPane')) map.createPane('prefPane');
        map.getPane('seaPane').style.zIndex = 200;
        map.getPane('prefPane').style.zIndex = 401;

        // 海（大きな矩形で塗りつぶす）
        L.rectangle([[-90, -180], [90, 180]], {
            pane: 'seaPane',
            interactive: false,
            stroke: false,
            fillColor: '#c2d2fe', // 海の色（薄い青）
            fillOpacity: 1
        }).addTo(map);

        // 都道府県ポリゴン（陸地色＋境界線）
        L.geoJSON(geo, {
            pane: 'prefPane',
            style: function(feature) {
                return {
                    color: '#41573e',    // 県境の色（濃い緑）
                    weight: 1,
                    fillColor: '#82997f', // 陸地の色（やや緑寄り）
                    fillOpacity: 1
                };
            },
            interactive: false
        }).addTo(map);
    })
    .catch(e => {
        console.warn('prefectures.geojson を読み込めませんでした:', e);
    });

// --- 2. データの読み込みと表示 ---
// GitHub Actionsが生成した weather_data.json を読み込む
fetch('./weather_data.json')
    .then(response => {
        if (!response.ok) {
            throw new Error("HTTP error " + response.status);
        }
        return response.json();
    })
    .then(stations => {
        // データ読み込み成功時の処理
        drawMap(stations);
    })
    .catch(error => {
        console.error("データの読み込みに失敗しました:", error);
        // エラー時はダミーデータを表示するなどの処理を入れても良い
    });

// 色を決める関数
function getColor(temp) {
    const t = parseFloat(temp);
    if (isNaN(t)) return '#808080';
    if (t >= 35) return '#ab0168'; // 猛暑日（紫）
    if (t >= 30) return '#f22900'; // 真夏日（赤）
    if (t >= 25) return '#f59900'; // 夏日（オレンジ）
    if (t >= 20) return '#f7f500'; 
    if (t >= 15) return '#fdff95'; 
    if (t >= 10) return '#fffff0'; 
    if (t >= 5) return '#c0ebff';
    if (t >= 0) return '#4196ff';
    if (t >= -5) return '#2f42ff';
    if (t >= -10) return '#132080';
    return '#0c1139'; // 氷点下（濃い青）
}

// グラフのインスタンス保持用
let tempChart = null;

// マーカーを保持
const stationMarkers = [];

// 表示モードの閾値（このズーム以下で四角を表示）
const SQUARE_ZOOM_THRESHOLD = 7.5;

function drawMap(stations) {
    stations.forEach(station => {
        const marker = L.marker([station.lat, station.lon]).addTo(map);
        marker.station = station; // 参照保存
        marker.on('click', () => showDetails(station));
        stationMarkers.push(marker);
    });

    // 初期表示のアイコン更新
    updateMarkersDisplay();

    // ズームが変わったら表示切替
    map.on('zoomend', updateMarkersDisplay);
}

// アイコン作成ヘルパー
function createIcon(station, mode) {
    const color = getColor(station.current);
    const numeric = Number(station.current);
    const isNumber = Number.isFinite(numeric);
    const display = isNumber ? numeric.toFixed(1) : String(station.current);

    if (mode === 'square') {
        return L.divIcon({
            className: 'square-label',
            html: `<div style="background:${color}; width:100%; height:100%; border-radius:2px;"></div>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7]
        });
    }

    // 数字ラベルモード（小数第一位まで表示）
    // 5℃以上なら黒縁のクラスを付与
    const hotClass = (isNumber && numeric >= 5) ? ' temp-label hot' : ' temp-label';

    // 地点名を数字の下に表示
    const safeName = station.name ? String(station.name) : '';
    const html = `
        <div style="color:${color};">
            <div class="temp-num">${display}</div>
            <div class="station-name">${safeName}</div>
        </div>
    `;

    return L.divIcon({
        className: hotClass.trim(),
        html: html,
        iconSize: [60, 28],
        iconAnchor: [30, 14]
    });
}

// マーカーの表示モードを更新
function updateMarkersDisplay() {
    const zoom = map.getZoom();
    const mode = (zoom <= SQUARE_ZOOM_THRESHOLD) ? 'square' : 'label';
    stationMarkers.forEach(marker => {
        const station = marker.station;
        const icon = createIcon(station, mode);
        marker.setIcon(icon);
    });
}

// --- 3. 詳細表示 ---
function showDetails(station) {
    const panel = document.getElementById('info-panel');
    panel.classList.remove('hidden');

    document.getElementById('station-name').innerText = station.name;
    // 現在値を小数第一位まで表示
    const currentFormatted = (Number.isFinite(Number(station.current))) ? Number(station.current).toFixed(1) : station.current;
    document.getElementById('current-val').innerText = currentFormatted;

    // --- 簡易シミュレーション ---
    // 過去データの取得はAPI制限等のため、ここでは現在の値に基づいたシミュレーションを表示します
    // 本格的にやるなら、Python側で過去データも収集してJSONに含める必要があります
    const dayMax = (Number(station.current) + Math.random() * 3).toFixed(1);
    const dayMin = (Number(station.current) - Math.random() * 5).toFixed(1);
    
    document.getElementById('day-max').innerText = dayMax + "℃";
    document.getElementById('day-min').innerText = dayMin + "℃";
    // 観測史上データは固定値（デモ用）
    document.getElementById('hist-max').innerText = "--"; 
    document.getElementById('hist-min').innerText = "--"; 

    // グラフデータの作成（シミュレーション）
    const labels = [];
    const dataPoints = [];
    for (let i = 24; i >= 0; i--) {
        const d = new Date();
        d.setHours(d.getHours() - i);
        labels.push(d.getHours() + ":00");
        
        const hour = d.getHours();
        const baseTemp = Number(station.current);
        let variation = Math.sin((hour - 6) / 12 * Math.PI) * 5; 
        if(hour < 6 || hour > 18) variation -= 2;

        // 数値を小数第一位で丸めて格納（数値型）
        const value = Math.round((baseTemp + variation * 0.2) * 10) / 10;
        dataPoints.push(value);
    }
    // 最新の点は現在の値（小数第一位まで丸め）
    dataPoints[dataPoints.length - 1] = Math.round(Number(station.current) * 10) / 10;

    renderChart(labels, dataPoints);
}

// Chart.jsでの描画
function renderChart(labels, data) {
    const ctx = document.getElementById('tempChart').getContext('2d');
    if (tempChart) tempChart.destroy();

    tempChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '気温推移(イメージ)',
                data: data,
                borderColor: '#f80',
                backgroundColor: 'rgba(255, 136, 0, 0.2)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: false, ticks: { callback: function(v){ return (Math.round(v*10)/10).toFixed(1); } } }
            }
            ,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const v = context.parsed.y;
                            if (v === null || v === undefined) return '';
                            return (Math.round(v*10)/10).toFixed(1) + '℃';
                        }
                    }
                }
            }
        }
    });
}

document.getElementById('close-btn').addEventListener('click', () => {
    document.getElementById('info-panel').classList.add('hidden');
});