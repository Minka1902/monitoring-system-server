const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');
const wellio = require('wellio');

function readDirectoryTree(directoryPath) {
    const stats = fs.statSync(directoryPath);

    if (!stats.isDirectory()) {
        return {
            name: path.basename(directoryPath),
            type: 'file',
        };
    }

    const items = fs.readdirSync(directoryPath);
    const tree = {
        name: path.basename(directoryPath),
        type: 'directory',
        children: [],
    };

    items.forEach((item) => {
        const itemPath = path.join(directoryPath, item);
        const childTree = readDirectoryTree(itemPath);
        tree.children.push(childTree);
    });

    return tree;
};

function constructUrl(parts) {
    // Ensure there are at least two parts (root and filename)
    if (parts.length < 2) {
        throw new Error('Invalid parts array. It should have at least two elements.');
    }

    // Combine the parts into a URL
    const url = parts.reduce((acc, part, index) => {
        // Use a leading slash for the root and between other parts
        const separator = index === 0 ? '' : '/';
        return `${acc}${separator}${part}`;
    }, '');

    return url;
};

function processCsvFile(filePath) {
    return new Promise((resolve) => {
        const data = [];
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row) => {
                if (row) {
                    for (const prop in row) {
                        if (prop !== 'month') {
                            row[prop] = parseFloat(row[prop])
                        }
                    }
                    data.push(row);
                }
            })
            .on('end', () => {
                resolve(data);
            });
    });
};

async function processLasFile(filePath) {
    const data = fs.readFileSync(filePath, { encoding: 'utf8' });
    return data;
};

function findFileAndPath(tree, targetName, pathToFileArray = []) {
    if (tree.name === targetName) {
        return { node: tree, pathToFileArray: [...pathToFileArray, tree.name] };
    }

    // for (const child in tree.children) {
    if (tree.children && tree.children.length > 0) {
        for (let i = 0; i < tree.children.length; i++) {
            const result = findFileAndPath(tree.children[i], targetName, [...pathToFileArray, tree.name]);
            if (result.node) {
                return result;
            }
        }
    }

    return { node: null, path: [] };
};

// POST /files
// ! request structure
// ? req.body={ folderName: 'main' }
module.exports.getAllPageFiles = async (req, res) => {
    try {
        const { folderName } = req.body;
        const folder = readDirectoryTree(`./files/${folderName}`);
        let pageData = {};
        if (folder) {
            for (let i = 0; i < folder.children.length; i++) {
                let { node, pathToFileArray } = findFileAndPath(folder, folder.children[i].name);
                if (node && pathToFileArray) {
                    const pathToFile = constructUrl(pathToFileArray);
                    const pathFromRoot = path.join(__dirname, `../files/${pathToFile}`);
                    let fileData;
                    if (pathToFile.slice(pathToFile.lastIndexOf('.')) === '.csv') {
                        fileData = await processCsvFile(pathFromRoot);
                    } else {
                        const well_as_string = await processLasFile(pathFromRoot);
                        const well = wellio.las2json(well_as_string);
                        fileData = well;
                    }
                    pageData[node.name.slice(0, node.name.lastIndexOf('.'))] = fileData;
                }
            }
        }
        if (pageData) {
            res.send(pageData);
        }
    } catch {
        res.send({ error: 'There has been an error' });
    }
};

// POST /file
// ! request structure
// ? req.body={ fileName: 'example.csv' }
module.exports.getFile = async (req, res) => {
    try {
        const { fileName } = req.body;
        const directoryTree = readDirectoryTree(`./csvFiles`);
        if (directoryTree) {
            const { node, pathToFileArray } = findFileAndPath(directoryTree, fileName);
            if (node && pathToFileArray) {
                const pathToFile = constructUrl(pathToFileArray);
                const pathFromRoot = path.join(__dirname, `../${pathToFile}`);
                const fileData = await processCsvFile(pathFromRoot);
                if (fileData) {
                    res.send(fileData);
                }
            }
        }
    } catch {
        res.send('Could not find directory');
    }
};
