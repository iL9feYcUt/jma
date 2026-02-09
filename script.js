// --- 1. 地図の初期化 ---
const map = L.map('map').setView([36.2048, 138.2529], 5);

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 19
}).addTo(map);

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
    if (temp >= 35) return '#b40068'; // 猛暑日（紫）
    if (temp >= 30) return '#ff2800'; // 真夏日（赤）
    if (temp >= 25) return '#ff9900'; // 夏日（オレンジ）
    if (temp >= 20) return '#ffcc00'; 
    if (temp >= 15) return '#ffff00'; 
    if (temp >= 10) return '#0099ff'; 
    if (temp >= 5) return '#0000ff';
    return '#002080'; // 氷点下（濃い青）
}

// グラフのインスタンス保持用
let tempChart = null;

function drawMap(stations) {
    stations.forEach(station => {
        const tempColor = getColor(station.current);
        
        // 数値を表示するためのカスタムアイコン
        const myIcon = L.divIcon({
            className: 'temp-label',
            html: `<div style="color:${tempColor}; font-size:12px; text-shadow: 1px 1px 0 #fff;">${station.current}</div>`,
            iconSize: [40, 20]
        });

        const marker = L.marker([station.lat, station.lon], { icon: myIcon }).addTo(map);

        marker.on('click', () => {
            showDetails(station);
        });
    });
}

// --- 3. 詳細表示 ---
function showDetails(station) {
    const panel = document.getElementById('info-panel');
    panel.classList.remove('hidden');

    document.getElementById('station-name').innerText = station.name;
    document.getElementById('current-val').innerText = station.current;

    // --- 簡易シミュレーション ---
    // 過去データの取得はAPI制限等のため、ここでは現在の値に基づいたシミュレーションを表示します
    // 本格的にやるなら、Python側で過去データも収集してJSONに含める必要があります
    const dayMax = (station.current + Math.random() * 3).toFixed(1);
    const dayMin = (station.current - Math.random() * 5).toFixed(1);
    
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
        
        // 現在気温を基準に、サインカーブで日内変動っぽく見せる
        // 昼（12-14時）が高くなるように調整
        const hour = d.getHours();
        const baseTemp = station.current;
        let variation = Math.sin((hour - 6) / 12 * Math.PI) * 5; 
        // 夜は下げる
        if(hour < 6 || hour > 18) variation -= 2;

        // 現在値との差分を調整（あくまでデモロジックです）
        dataPoints.push((baseTemp + variation * 0.2).toFixed(1)); 
    }
    // 最新の点は現在の値に合わせる
    dataPoints[dataPoints.length - 1] = station.current;

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
                y: { beginAtZero: false }
            }
        }
    });
}

document.getElementById('close-btn').addEventListener('click', () => {
    document.getElementById('info-panel').classList.add('hidden');
});