// --- 1. 地図の初期化 ---
// 日本の中心あたりを表示
const map = L.map('map').setView([36.2048, 138.2529], 5);

// 地図タイル（背景）の設定：今回はシンプルで見やすいCartoDBを使用
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 19
}).addTo(map);

// --- 2. データの準備（シミュレーション） ---
// 本番ではここで気象庁のJSONなどをfetchしますが、まずは動くモックデータを作ります
const stations = [
    { name: "東京", lat: 35.6895, lon: 139.6917, current: 15.2 },
    { name: "大阪", lat: 34.6937, lon: 135.5023, current: 16.5 },
    { name: "札幌", lat: 43.0618, lon: 141.3545, current: 5.1 },
    { name: "那覇", lat: 26.2124, lon: 127.6809, current: 24.8 },
    { name: "仙台", lat: 38.2682, lon: 140.8694, current: 11.3 },
    { name: "福岡", lat: 33.5904, lon: 130.4017, current: 17.2 },
    { name: "新潟", lat: 37.9162, lon: 139.0364, current: 10.5 },
    { name: "名古屋", lat: 35.1815, lon: 136.9066, current: 15.8 }
];

// 色を決める関数（気温によって色を変える）
function getColor(temp) {
    if (temp >= 30) return '#ff0000'; // 真夏日
    if (temp >= 25) return '#ff8c00'; // 夏日
    if (temp >= 15) return '#008000'; // 快適
    if (temp >= 10) return '#1e90ff'; // 肌寒い
    return '#0000ff'; // 寒い
}

// グラフのインスタンス保持用
let tempChart = null;

// --- 3. マーカーの配置 ---
stations.forEach(station => {
    // 数値を表示するためのカスタムアイコンを作成
    const tempColor = getColor(station.current);
    const myIcon = L.divIcon({
        className: 'temp-label',
        html: `<div style="color:${tempColor}; font-size:14px;">${station.current}</div>`,
        iconSize: [40, 20]
    });

    // マーカーを追加
    const marker = L.marker([station.lat, station.lon], { icon: myIcon }).addTo(map);

    // クリックイベント
    marker.on('click', () => {
        showDetails(station);
    });
});

// --- 4. 詳細表示とグラフ描画 ---
function showDetails(station) {
    const panel = document.getElementById('info-panel');
    panel.classList.remove('hidden');

    // 基本情報の流し込み
    document.getElementById('station-name').innerText = station.name;
    document.getElementById('current-val').innerText = station.current;

    // データ生成（実際はAPIから過去データを取得します）
    // ここではランダムなそれっぽいデータを生成しています
    const dayMax = (station.current + Math.random() * 5).toFixed(1);
    const dayMin = (station.current - Math.random() * 5).toFixed(1);
    
    document.getElementById('day-max').innerText = dayMax + "℃";
    document.getElementById('day-min').innerText = dayMin + "℃";
    document.getElementById('hist-max').innerText = (parseFloat(dayMax) + 10).toFixed(1) + "℃"; // 仮
    document.getElementById('hist-min').innerText = "-2.5℃"; // 仮

    // グラフデータの作成（過去24時間分をシミュレート）
    const labels = [];
    const dataPoints = [];
    for (let i = 24; i >= 0; i--) {
        const d = new Date();
        d.setHours(d.getHours() - i);
        labels.push(d.getHours() + ":00");
        
        // サインカーブっぽく気温を変動させる
        const variation = Math.sin(i/3) * 3; 
        dataPoints.push(station.current - variation);
    }

    renderChart(labels, dataPoints);
}

// Chart.jsでの描画
function renderChart(labels, data) {
    const ctx = document.getElementById('tempChart').getContext('2d');

    // 既存のチャートがあれば破棄（二重描画防止）
    if (tempChart) {
        tempChart.destroy();
    }

    tempChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '過去24時間の気温',
                data: data,
                borderColor: 'rgba(75, 192, 192, 1)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                tension: 0.4, // 曲線を滑らかに
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: false
                }
            }
        }
    });
}

// 閉じるボタン
document.getElementById('close-btn').addEventListener('click', () => {
    document.getElementById('info-panel').classList.add('hidden');
});