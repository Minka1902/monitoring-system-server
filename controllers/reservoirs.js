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
}

function processCsvFile(filePath) {
    return new Promise((resolve) => {
        const data = [];
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row) => {
                if (row) {
                    data.push(row);
                }
            })
            .on('end', () => {
                resolve(data);
            });
    });
};

async function sumWellsData(node, pathToFile) {
    if (node.children && node.children.length > 0) {
        if (node.children[0].name.slice(-4) !== '.csv') {
            const results = await Promise.all(
                node.children.map(async (child) => {
                    return await sumWellsData(child, `${pathToFile}/${child.name}`);
                })
            );
            const filteredResults = results.filter((result) => result !== null);
            return filteredResults.length > 0 ? filteredResults : null;
        } else {
            const results = { test: [], production: [], drilling: [] };
            await Promise.all(
                node.children.map(async (child) => {
                    const filePath = path.join(__dirname, `${pathToFile}/${child.name}`);
                    const fileData = await processCsvFile(filePath);
                    const objectName = child.name.slice(child.name.lastIndexOf('-') + 1, -4);
                    results[objectName] = results[objectName].concat(fileData);
                })
            );
            return results;
        }
    }
    return null;
}

// POST /reservoir
// ! request structure
// ? req.body={ path: '/path/to/reservoir }
module.exports.getArrayOfWells = (req, res) => {
    const results = [];
    fs.createReadStream(path.join(__dirname, `../forTreeView${req.body.path}`))
        .pipe(csv())
        .on('data', (data) => {
            results.push(data);
        })
        .on('end', () => {
            res.json(results);
        });
};

// GET /reservoir
// ! request structure
// ? req.body={ path: '/path/to/reservoir }
module.exports.getFileStructure = (req, res) => {
    const directoryTree = readDirectoryTree('./forTreeView');
    res.send({ tree: directoryTree });
};

// POST /reservoir
// ! request structure
// ? req.body={ path: '/path/to/reservoir }
module.exports.scanDirectoryTree = async (req, res) => {
    const { folderName } = req.body;
    const directoryTree = readDirectoryTree(`./forTreeView/${folderName}`);
    if (directoryTree) {
        const results = await sumWellsData(directoryTree, `../forTreeView/${folderName}`);
        if (typeof results === 'object' && results.length !== undefined) {
            res.send(results);
        } else {
            res.send(typeof results === 'object' && results.length === undefined ? results : results[0]);
        }
    } else {
        res.send('Could not find directory');
    }
};
