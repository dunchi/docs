

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
            padding: 1.5rem 1.5rem 0 1.5rem;
            flex-grow: 1;
            display: flex;
            flex-direction: column;
        }
        .card-title {
            font-size: 1.25rem;
            font-weight: 600;
            margin: 0;
            color: #34495e;
        }
        .card-description {
            font-size: 0.9em;
            color: #666;
            margin-top: auto;
            margin-bottom: 0.5rem;
            display: flex;
            align-items: center;
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
        .home-link {
            display: block;
            text-align: center;
            margin: 0 auto;
            margin-top: 2rem;
            text-decoration: none;
            color: #007bff;
            font-weight: 500;
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

const FILE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-file"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>`;
const FOLDER_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-folder"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>`;
const FILE_ICON_ZERO = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-file-x-2"><path d="M20 13V7L15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h4"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>

<path d="m17 17 5 5"/><path d="m22 17-5 5"/></svg>`;
const FOLDER_ICON_ZERO = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-folder-x"><path d="M10 20H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H20a2 2 0 0 1 2 2v4"/><path d="m17 17 5 5"/><path d="m22 17-5 5"/></svg>`;

// Function to generate a card HTML string
function getCardHtml(item, relativePath = '') {
    const isFolder = item.type === 'directory';
    const fileName = item.name.replace('.html', '');
    const linkPath = isFolder ? `${relativePath}${item.path}/index.html` : `${relativePath}${item.path}`;
    let cardTitle = isFolder ? item.name : fileName;
    let cardDescription = '';

    if (item.path === 'about.html') {
        cardTitle = '소개';
        cardDescription = '이 사이트에 대한 정보를 확인하세요.';
    } else if (isFolder) {
        const fileCount = item.children.filter(c => c.type === 'file').length || '';
        const folderCount = item.children.filter(c => c.type === 'directory').length || '';

        const fileIcon = fileCount > 0 ? FILE_ICON : FILE_ICON_ZERO;
        const folderIcon = folderCount > 0 ? FOLDER_ICON : FOLDER_ICON_ZERO;

        cardDescription = `
            <span style="color: #007bff; display: inline-flex; align-items: center;">${fileIcon}&nbsp&nbsp${fileCount}</span>&nbsp&nbsp&nbsp|&nbsp&nbsp&nbsp
            <span style="color: #28a745; display: inline-flex; align-items: center;">${folderIcon}&nbsp&nbsp${folderCount}</span>
        `;
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

// Function to recursively build a tree structure of files and folders
function buildTree(dir, currentPath = '') {
    const tree = { name: path.basename(dir), path: currentPath, type: 'directory', children: [] };
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        const relativeItemPath = path.join(currentPath, file);

        if (stat.isDirectory()) {
            const subTree = buildTree(filePath, relativeItemPath);
            // Only add subdirectory if it contains relevant content (i.e., has children)
            if (subTree.children.length > 0) {
                tree.children.push(subTree);
            }
        } else if (stat.isFile() && file.endsWith('.html') && file !== 'index.html' && !file.endsWith('-script.html')) {
            tree.children.push({ name: file, path: relativeItemPath, type: 'file' });
        }
    });

    // Sort children: directories first, then files, both alphabetically
    tree.children.sort((a, b) => {
        if (a.type === 'directory' && b.type === 'file') return -1;
        if (a.type === 'file' && b.type === 'directory') return 1;
        return a.name.localeCompare(b.name);
    });

    return tree;
}

// Function to generate index.html for a given directory in the tree
function generateIndexPage(node, rootDir) {
    if (node.type === 'file') return; // Only generate for directories

    let cardsHtml = '';
    const currentDirPath = path.join(rootDir, node.path);
    const relativePathToRoot = path.relative(currentDirPath, rootDir).replace(/\\/g, '/');

    // Prioritize about.html if it's a direct child of the current node
    const aboutFile = node.children.find(child => child.path === 'about.html');
    if (aboutFile) {
        cardsHtml += getCardHtml(aboutFile, relativePathToRoot ? `${relativePathToRoot}/` : '');
    }

    node.children.forEach(child => {
        if (child.path !== 'about.html') { // Skip about.html if already processed
            cardsHtml += getCardHtml(child, relativePathToRoot ? `${relativePathToRoot}/` : '');
        }
        if (child.type === 'directory') {
            generateIndexPage(child, rootDir); // Recurse for subdirectories
        }
    });

    const pageTitle = node.path === '' ? '문서 아카이브' : node.path.replace(/\\/g, '/');
    const htmlContent = getBaseHtml(pageTitle, cardsHtml, relativePathToRoot ? `${relativePathToRoot}/` : '');
    fs.writeFileSync(path.join(currentDirPath, 'index.html'), htmlContent);
    console.log(`Generated index.html for ${node.path === '' ? 'root' : node.path}`);
}

// Main generation logic
function generatePages() {
    const rootDir = path.resolve(__dirname);
    const tree = buildTree(rootDir);

    // Generate index.html for root and all subdirectories
    generateIndexPage(tree, rootDir);
}

generatePages();
