

const fs = require('fs');
const path = require('path');

const owner = 'dunchi';
const repo = 'docs';

// Base HTML template function
function getBaseHtml(title, content, relativePath = '') {
    const homeLink = relativePath ? `${relativePath}index.html` : 'index.html';

    return `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background-color: #f4f7f6;
            color: #333;
            margin: 0;
            padding: 2rem;
        }
        .header {
            text-align: center;
            margin-bottom: 3rem;
        }
        .header h1 {
            font-size: 2.5rem;
            color: #2c3e50;
        }
        .header p {
            font-size: 1.1rem;
            color: #7f8c8d;
        }
        .container {
            max-width: 960px;
            margin: 0 auto;
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
            gap: 2rem;
        }
        .card, .card-stack {
            height: 170px;
            display: flex;
            flex-direction: column;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
            position: relative;
        }
        .card-link-wrapper {
            text-decoration: none;
            color: inherit;
            display: flex;
            flex-direction: column;
            height: 100%;
        }
        .card-content-wrapper {
            background-color: #ffffff;
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
            overflow: hidden;
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            position: relative;
            z-index: 2;
        }
        .card:hover .card-content-wrapper, .card-stack:hover .card-content-wrapper {
            transform: translateY(-5px);
            box-shadow: 0 12px 30px rgba(0, 0, 0, 0.12);
        }
        .card-stack::before, .card-stack::after {
            content: "";
            position: absolute;
            border-radius: 12px;
            background-color: #ffffff;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.05);
            width: 100%;
            height: 100%;
            transition: transform 0.3s ease;
        }
        .card-stack::before {
            z-index: 1;
            transform: rotate(-4deg);
        }
        .card-stack::after {
            z-index: 0;
            transform: rotate(4deg);
        }
        .card-stack:hover::before { transform: rotate(-6deg) translateY(-5px); }
        .card-stack:hover::after { transform: rotate(6deg) translateY(-5px); }
        .card-content {
            padding: 1.5rem;
            flex-grow: 1;
        }
        .card-title {
            font-size: 1.25rem;
            font-weight: 600;
            margin: 0 0 0.5rem 0;
            color: #34495e;
        }
        .card-description {
            font-size: 0.95rem;
            color: #7f8c8d;
            margin: 0;
        }
        .card-footer {
            padding: 1rem 1.5rem;
            background-color: #f8f9fa;
            border-top: 1px solid #e9ecef;
            text-align: right;
            font-weight: 500;
            color: #007bff;
        }
        .loader {
            text-align: center;
            padding: 3rem;
            font-size: 1.2rem;
            color: #7f8c8d;
        }
        .nav-links {
            text-align: center;
            margin-top: 2rem;
        }
        .nav-links a {
            text-decoration: none;
            color: #007bff;
            font-weight: 500;
            margin: 0 10px;
        }
    </style>
</head>
<body>

    <header class="header">
        <h1>${title}</h1>
        <p>Anything and Everything;</p>
    </header>

    <div class="container" id="card-container">
        ${content}
    </div>

    ${relativePath ? `<a href="${homeLink}" class="home-link">&larr; 메인으로 돌아가기</a>` : ''}

</body>
</html>
    `;
}

// Function to generate a card HTML string
function getCardHtml(file, isFolder = false, filesInFolder = 0, relativePath = '') {
    const fileName = file.split('/').pop().replace('.html', '');
    const linkPath = isFolder ? `${relativePath}${file}/index.html` : `${relativePath}${file}`;
    let cardTitle = isFolder ? file.split('/').pop() : fileName;
    let cardDescription = ''; // Default to empty for single files

    if (file === 'about.html') {
        cardTitle = '소개';
        cardDescription = '이 사이트에 대한 정보를 확인하세요.';
    } else if (isFolder) {
        cardDescription = `${filesInFolder}개의 문서 포함`;
    }
    const footerText = isFolder ? '폴더 열기 &rarr;' : '문서 보기 &rarr;';

    const cardClass = isFolder ? 'card-stack' : 'card';

    return `
        <div class="${cardClass}">
            <a href="${linkPath}" class="card-link-wrapper">
                <div class="card-content-wrapper">
                    <div class="card-content">
                        <h2 class="card-title">${cardTitle}</h2>
                        <p class="card-description">${cardDescription}</p>
                    </div>
                    <div class="card-footer">${footerText}</div>
                </div>
            </a>
        </div>
    `;
}

// Function to recursively get all HTML files and directories
function getFilesAndFolders(dir, fileList = []) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            // Check if directory contains any HTML files
            const htmlFilesInDir = fs.readdirSync(filePath).filter(f => f.endsWith('.html'));
            if (htmlFilesInDir.length > 0) {
                fileList.push({ path: filePath, type: 'directory' });
            }
            getFilesAndFolders(filePath, fileList); // Recurse into subdirectories
        } else if (stat.isFile() && file.endsWith('.html') && file !== 'index.html') {
            fileList.push({ path: filePath, type: 'file' });
        }
    });

    return fileList;
}

// Main generation logic
function generatePages() {
    const rootDir = path.resolve(__dirname);
    const allItems = getFilesAndFolders(rootDir);

    // Group files by directory
    const groupedItems = allItems.reduce((acc, item) => {
        const relativePath = path.relative(rootDir, item.path);
        const parts = relativePath.split(path.sep);

        if (item.type === 'directory') {
            acc[relativePath] = acc[relativePath] || { files: [], type: 'directory' };
        } else { // type is 'file'
            if (parts.length > 1) {
                const dir = parts.slice(0, -1).join(path.sep);
                acc[dir] = acc[dir] || { files: [], type: 'directory' };
                acc[dir].files.push(relativePath);
            } else {
                acc['.'] = acc['.'] || { files: [], type: 'root' }; // Use '.' for root files
                acc['.'].files.push(relativePath);
            }
        }
        return acc;
    }, {});

    // Generate root index.html
    let rootCardsHtml = '';
    const rootFiles = groupedItems['.'] ? groupedItems['.'].files : [];
    const rootFolders = Object.keys(groupedItems).filter(key => key !== '.' && groupedItems[key].type === 'directory');

    rootFolders.forEach(folderPath => {
        const filesInFolder = groupedItems[folderPath].files.length;
        rootCardsHtml += getCardHtml(folderPath, true, filesInFolder, '');
    });

    rootFiles.forEach(filePath => {
        rootCardsHtml += getCardHtml(filePath, false, 0, '');
    });

    fs.writeFileSync(path.join(rootDir, 'index.html'), getBaseHtml('문서 아카이브', rootCardsHtml, ''));
    console.log('Generated root index.html');

    // Generate index.html for each folder
    for (const dirPath in groupedItems) {
        if (dirPath === '.') continue; // Skip root

        const folderItems = groupedItems[dirPath].files;
        if (folderItems.length === 0) continue; // Skip empty folders

        let folderCardsHtml = '';
        const relativePathToRoot = path.relative(path.join(rootDir, dirPath), rootDir).replace(/\\/g, '/'); // For back navigation

        folderItems.forEach(filePath => {
            const fileName = path.basename(filePath);
            folderCardsHtml += getCardHtml(fileName, false, 0, ''); // Pass only filename for link
        });

        const folderTitle = dirPath.replace(/\\/g, '/'); // Use forward slashes for title
        const folderIndexHtml = getBaseHtml(folderTitle, folderCardsHtml, relativePathToRoot + '/');
        fs.writeFileSync(path.join(rootDir, dirPath, 'index.html'), folderIndexHtml);
        console.log(`Generated index.html for ${dirPath}`);
    }
}

generatePages();
