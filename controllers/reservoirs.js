const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

function readDirectoryTree(directoryPath) {
    const stats = fs.statSync(directoryPath);
    // ! need to get config file and pass it on

    if (!stats.isDirectory()) {
        return {
            name: path.basename(directoryPath),
            type: 'file',
        };
    }

    const items = fs.readdirSync(directoryPath);
    // ? here we add the reorder function
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

function processCsvFile(filePath) {
    return new Promise((resolve) => {
        const data = [];
        try {
            fs.access(filePath, fs.constants.F_OK, (err) => {
                if (err) {
                    resolve('File not found.');
                    return;
                }
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
        } catch (err) {
            console.log(err);
        }
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
};

// POST /reservoir
// ! request structure
// ? req.body={ path: '/path/to/reservoir }
module.exports.getArrayOfWells = (req, res) => {
    const results = { drilling: [], production: [], test: [] };
    try {
        fs.access(path.join(__dirname, `..${req.body.path}`), fs.constants.F_OK, (err) => {
            if (err) {
                return;
            }
            fs.createReadStream(path.join(__dirname, `..${req.body.path}`))
                .pipe(csv())
                .on('data', (data) => {
                    let prop = req.body.path.slice(req.body.path.lastIndexOf('-') + 1, -4);
                    if (prop !== 'production' && prop !== 'drilling' && prop !== 'test') {
                        prop = req.body.path.slice(req.body.path.lastIndexOf('/') + 1, -4);
                    }
                    results[prop].push(data);
                })
                .on('end', () => {
                    res.json(results);
                });
        });
    } catch (err) {
        console.log(err);
    }
};

function getLastNodesWithPaths(node) {
    if (!node.children || node.children.length === 0) {
        // If the current node is a last node, return an object containing the node and its path
        return [node];
    } else {
        // If the current node has children, recursively traverse them
        const lastNodesWithPath = [];
        node.children.forEach((child, index) => {
            const childLastNodesWithPath = getLastNodesWithPaths(child);
            lastNodesWithPath.push(...childLastNodesWithPath);
        });
        return lastNodesWithPath;
    }
};

function addChildToFirstNode(tree, firstNodeName, secondNode) {
    function traverse(node) {
        if (node.name === firstNodeName) {
            if (!node.children) {
                node.children = [];
            }
            node.children.push(secondNode);
            return true;
        }
        if (node.children) {
            for (const child of node.children) {
                if (traverse(child)) {
                    return true;
                }
            }
        }
        return false;
    }

    traverse(tree);
};

function addPathToNodes(tree) {
    function traverse(node, path = '') {
        const nodePath = `${path}/${node.name}`;
        node.path = nodePath;

        if (node.children) {
            for (const child of node.children) {
                traverse(child, nodePath);
            }
        }
    }

    traverse(tree);
};

// GET /reservoir
// ! request structure
// ? req.body={ path: '/path/to/reservoir }
module.exports.getFileStructure = async (req, res) => {
    let directoryTree = readDirectoryTree('./forTreeView');
    addPathToNodes(directoryTree);

    const lastNodes = getLastNodesWithPaths(directoryTree);
    for (let i = 0; i < lastNodes.length; i++) {
        const pathToFile = path.join(__dirname, `..${lastNodes[i].path}`);
        if (lastNodes[i].type === 'file') {
            const fileContent = await processCsvFile(pathToFile);
            for (let j = 0; j < fileContent.length; j++) {
                const newNode = { ...fileContent[j], type: 'well', stage: lastNodes[i].name.slice(lastNodes[i].name.lastIndexOf('-') + 1, -4) };
                addChildToFirstNode(directoryTree, lastNodes[i].name, newNode);
            }
        }
    }

    res.send({ tree: directoryTree });
};

// POST /reservoir
// ! request structure
// ? req.body={ path: '/path/to/reservoir }
module.exports.scanDirectoryTree = async (req, res) => {
    try {
        const { folderName } = req.body;
        const directoryTree = readDirectoryTree(`./forTreeView/${folderName === undefined ? '' : folderName}`);
        if (directoryTree) {
            const results = await sumWellsData(directoryTree, `../forTreeView/${folderName}`);
            if (typeof results === 'object' && results.length !== undefined) {
                res.send(results);
            } else {
                res.send(typeof results === 'object' && results.length === undefined ? results : results[0]);
            }
        }
    } catch {
        res.send('Could not find directory');
    }
};

module.exports.initWells = async (req, res) => {
    try {
        let directoryTree = readDirectoryTree('./forTreeView');
        addPathToNodes(directoryTree);

        const lastNodes = getLastNodesWithPaths(directoryTree);
        for (let i = 0; i < lastNodes.length; i++) {
            const pathToFile = path.join(__dirname, `..${lastNodes[i].path}`);
            if (lastNodes[i].type === 'file') {
                const fileContent = await processCsvFile(pathToFile);
                for (let j = 0; j < fileContent.length; j++) {
                    const newNode = { ...fileContent[j], type: 'well', stage: lastNodes[i].name.slice(lastNodes[i].name.lastIndexOf('-') + 1, -4) };
                    addChildToFirstNode(directoryTree, lastNodes[i].name, newNode);
                }
            }
        }

        const wells = { drilling: [], production: [], test: [] };
        const newLastNodes = getLastNodesWithPaths(directoryTree);
        for (const node of newLastNodes) {
            if (node.stage) {
                if (wells[node.stage] !== undefined) {
                    wells[node.stage].push(node);
                }
            }
        }
        res.send(wells);
    } catch (err) {
        console.log(err);
        res.send(err);
    }
};
