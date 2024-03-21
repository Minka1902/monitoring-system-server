const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');
const wellio = require('wellio');

function processStringCsvFile(filePath) {
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
                            for (const prop in row) {
                                if (prop !== 'month' && prop !== 'well') {
                                    row[prop] = parseFloat(row[prop]);
                                }
                            }
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

async function processLasFile(filePath) {
    const data = fs.readFileSync(filePath, { encoding: 'utf8' });
    return data;
};

async function processWellData(dataName, wellName) {
    let fileData = {};
    const filePath = path.join(__dirname, `../data/${dataName}/${wellName.toUpperCase()}${dataName === 'las_docs' ? '.las' : '.csv'}`);
    if (dataName === 'las_docs') {
        const wellAsString = await processLasFile(filePath);
        const well = wellio.las2json(wellAsString);
        fileData = well;
    } else {
        fileData = await processCsvFile(filePath);
    }
    return fileData;
};

async function processSafetyData() {
    const filePath = path.join(__dirname, '../data/safety/safety.csv');
    const safetyData = await processCsvFile(filePath);
    return safetyData;
};

async function processSeismicData() {
    const filePath = path.join(__dirname, '../data/seismic/seismic_status.csv');
    const seismicData = await processStringCsvFile(filePath);
    return seismicData;
};

async function processReservesData() {
    const filePath = path.join(__dirname, '../data/reserves/reserves.csv');
    const seismicData = await processStringCsvFile(filePath);
    return seismicData;
};

async function processPolygonData(polyName) {
    const filePath = path.join(__dirname, `../data/polygons/${polyName}.csv`);
    const polygonData = await processCsvFile(filePath);
    return polygonData;
};

function getAllFilesInFolder(folderPath) {
    const absoluteFolderPath = path.resolve(folderPath);
    try {
        const files = fs.readdirSync(absoluteFolderPath);

        const fileNames = files.filter((fileName) => {
            const fileStats = fs.statSync(path.join(absoluteFolderPath, fileName));
            return fileStats.isFile();
        });

        return fileNames;
    } catch (error) {
        console.error('Error reading folder:', error);
        return [];
    }
};

module.exports.getPageData = async (req, res) => {
    try {
        const { dataNames, wellNames } = req.body;
        let pageData = {};

        for (const dataName of dataNames) {
            pageData[dataName] = {};

            if (dataName !== 'polygons') {
                if (dataName !== 'safety') {
                    if (dataName !== 'seismic') {
                        if (dataName !== 'reserves') {
                            // ! Handling all the files
                            for (const wellName of wellNames) {
                                let fileData = await processWellData(dataName, wellName);
                                pageData[dataName][wellName] = fileData || 'File wasn\'t found or access was denied.';
                            }
                        } else {
                            // ! Handling reserves
                            const reservesData = await processReservesData();
                            if (reservesData) {
                                for (const wellName of wellNames) {
                                    for (let reserve of reservesData) {
                                        if (reserve.name === wellName) {
                                            pageData[dataName][wellName] = reserve;
                                        }
                                    }
                                }
                            }
                        }
                    } else {
                        // ! Handling seismic surveys
                        const seismicData = await processSeismicData();
                        if (seismicData) {
                            for (const field of seismicData) {
                                for (const wellName of wellNames) {
                                    if (wellName.indexOf(field.seismic_survey) !== -1 && pageData[dataName][field.seismic_survey] === undefined) {
                                        pageData[dataName][field.seismic_survey] = { status: field.status };
                                    }
                                }
                            }
                        }
                    }
                } else {
                    // ! Handling safety
                    const safetyData = await processSafetyData();
                    for (const well of safetyData) {
                        for (const wellName of wellNames) {
                            if (wellName.toUpperCase() === well.well.toUpperCase()) {
                                pageData[dataName][wellName] = well.days_without_incidents;
                            }
                        }
                    }
                }
            } else {
                // ! Handling polygons
                const fileNames = getAllFilesInFolder(path.join(__dirname, `../data/polygons`));
                const polyNames = fileNames.map((fileName) => fileName.slice(0, -4));
                for (const polyName of polyNames) {
                    let fileData = await processPolygonData(polyName);
                    pageData[dataName][polyName] = fileData || 'File wasn\'t found or access was denied.';
                }
            }
        }

        res.send(pageData);
    } catch (err) {
        res.status(500).send({ message: 'Something went wrong.', error: err });
    }
};
