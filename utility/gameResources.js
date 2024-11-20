// gameResources.js
const path = require('path');
const { createCanvas, loadImage } = require('canvas');
const recipes = require('../recipes.json');
const items = require('../items.json');
const translations = require('../fr.json');

const IMAGES_FOLDER = '../Images';
const GRID_TEMPLATE_PATH = path.join(__dirname, '../Images/crafting_table_template.png');

// Retrieve an item by its ID
function getItemById(id) {
    const item = items.find(item => item.id === id);
    if (!item) {
        return { displayName: 'item inconnu', name: 'unknown' }; // Default values for unknown items
    }
    const frenchName = translations[item.name] || item.displayName;
    return {
        ...item,
        frenchDisplayName: frenchName,
    };
}

// Normalize the grid to 3x3 format
function normalizeGrid(inShape) {
    const gridSize = 3;
    const normalizedGrid = Array(gridSize).fill(null).map(() => Array(gridSize).fill(null));

    for (let row = 0; row < inShape.length; row++) {
        for (let col = 0; col < inShape[row].length; col++) {
            normalizedGrid[row][col] = inShape[row][col] === undefined ? null : inShape[row][col];
        }
    }

    return normalizedGrid;
}

// Generate the crafting grid image
async function generateCraftingGrid(grid) {
    const canvas = createCanvas(694, 694); // Canvas size matches crafting table
    const ctx = canvas.getContext('2d');

    // Load the crafting table template
    const template = await loadImage(GRID_TEMPLATE_PATH);
    ctx.drawImage(template, 0, 0, canvas.width, canvas.height);

    // Constants for positioning items within the grid
    const cellSize = 200;
    const borderSize = 25;
    const edgeOffsetX = 25;
    const edgeOffsetY = 25;
    const scaleFactor = 0.9;
    const scaledSize = cellSize * scaleFactor;
    const offset = (cellSize - scaledSize) / 2;

    // Draw each item's image on its corresponding grid position
    for (let row = 0; row < grid.length; row++) {
        for (let col = 0; col < grid[row].length; col++) {
            const cell = grid[row][col];
            if (cell && cell.imagePath) {
                const img = await loadImage(cell.imagePath);
                const x = edgeOffsetX + col * (cellSize + borderSize) + offset;
                const y = edgeOffsetY + row * (cellSize + borderSize) + offset;
                ctx.drawImage(img, x, y, scaledSize, scaledSize);
            }
        }
    }

    return canvas.toBuffer(); // Return the generated image as a buffer
}

// Fisher-Yates shuffle
function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]]; // Swap elements
    }
}

module.exports = {
    getItemById,
    normalizeGrid,
    generateCraftingGrid,
    shuffleArray,
    
};
