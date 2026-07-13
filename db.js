const fs = require('fs');
const path = require('path');
const dbFilePath = path.join(__dirname, 'db.json');

// Initialize the local JSON file database if it doesn't exist
if (!fs.existsSync(dbFilePath)) {
    fs.writeFileSync(dbFilePath, JSON.stringify([], null, 2));
}

// Local Database Controller
const Company = {
    // Save a new company
    save: async (companyRecord) => {
        try {
            const fileData = fs.readFileSync(dbFilePath, 'utf8');
            const companies = JSON.parse(fileData);

            // Create a unique ID and timestamp
            const newRecord = {
                _id: Date.now().toString(),
                ...companyRecord,
                createdAt: new Date().toISOString()
            };

            companies.push(newRecord);
            fs.writeFileSync(dbFilePath, JSON.stringify(companies, null, 2));
            return newRecord;
        } catch (error) {
            throw new Error('Failed to save to local database: ' + error.message);
        }
    },

    // Retrieve all companies
    find: async () => {
        try {
            const fileData = fs.readFileSync(dbFilePath, 'utf8');
            return JSON.parse(fileData);
        } catch (error) {
            return [];
        }
    }
};

const fieldsFilePath = path.join(__dirname, 'fields.json');
if (!fs.existsSync(fieldsFilePath)) {
    fs.writeFileSync(fieldsFilePath, JSON.stringify([], null, 2));
}

const TemplateField = {
    save: async (fieldRecord) => {
        try {
            const fileData = fs.readFileSync(fieldsFilePath, 'utf8');
            const fields = JSON.parse(fileData);
            const newRecord = {
                id: Date.now().toString(),
                ...fieldRecord,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            fields.push(newRecord);
            fs.writeFileSync(fieldsFilePath, JSON.stringify(fields, null, 2));
            return newRecord;
        } catch (error) {
            throw new Error('Failed to save template field: ' + error.message);
        }
    },
    find: async (query = {}) => {
        try {
            const fileData = fs.readFileSync(fieldsFilePath, 'utf8');
            const fields = JSON.parse(fileData);
            return fields.filter(f => {
                for (let key in query) {
                    if (f[key] !== query[key]) return false;
                }
                return true;
            });
        } catch (error) {
            return [];
        }
    },
    update: async (id, updates) => {
        try {
            const fileData = fs.readFileSync(fieldsFilePath, 'utf8');
            let fields = JSON.parse(fileData);
            const index = fields.findIndex(f => f.id === id);
            if (index === -1) throw new Error('Field not found');
            fields[index] = {
                ...fields[index],
                ...updates,
                updatedAt: new Date().toISOString()
            };
            fs.writeFileSync(fieldsFilePath, JSON.stringify(fields, null, 2));
            return fields[index];
        } catch (error) {
            throw new Error('Failed to update template field: ' + error.message);
        }
    },
    delete: async (id) => {
        try {
            const fileData = fs.readFileSync(fieldsFilePath, 'utf8');
            let fields = JSON.parse(fileData);
            const newFields = fields.filter(f => f.id !== id);
            fs.writeFileSync(fieldsFilePath, JSON.stringify(newFields, null, 2));
            return true;
        } catch (error) {
            throw new Error('Failed to delete template field: ' + error.message);
        }
    }
};

module.exports = {
    Company,
    TemplateField
};