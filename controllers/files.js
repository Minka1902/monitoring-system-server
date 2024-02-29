const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

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

function findFileAndPath(tree, targetName, pathToFileArray = []) {
    if (tree.name === targetName) {
        return { node: tree, pathToFileArray: [...pathToFileArray, tree.name] };
    }

    for (const child of tree.children) {
        const result = findFileAndPath(child, targetName, [...pathToFileArray, tree.name]);
        if (result.node) {
            return result;
        }
    }

    return { node: null, path: [] };
};

// POST /file
// ! request structure
// ? req.body={ fileName: 'example.csv' }
module.exports.getFile = async (req, res) => {
    const { fileName } = req.body;
    const directoryTree = readDirectoryTree(`./csvFiles`);
    if (directoryTree) {
        const { node, pathToFileArray } = findFileAndPath(directoryTree, fileName);
        if (node && pathToFileArray) {
            const pathToFile = constructUrl(pathToFileArray);
            const pathFromRoot = path.join(__dirname, `../${pathToFile}`);
            const fileData = await processCsvFile(pathFromRoot);
            if (fileData) {
                if (directoryTree) {
                    if (node && pathToFileArray) {
                        res.send(fileData);
                    } else {
                        res.send('Could not parse file.');
                    }
                } else {
                    res.send('Could not find file in the file structure.');
                }
            }
        }
    } else {
        res.send('Could not find directory');
    }
};
