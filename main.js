// main.js

const { Plugin, PluginSettingTab, Setting, WorkspaceLeaf, ItemView } = require('obsidian');

// Unique ID for our view type
const CARD_VIEW_TYPE = 'card-view';

class CardViewPlugin extends Plugin {
    async onload() {
        console.log('Loading Card View Plugin');

        // Register the custom view type
        this.registerView(
            CARD_VIEW_TYPE,
            (leaf) => new CardView(leaf, this)
        );

        // Load settings
        await this.loadSettings();

        // Add settings tab
        this.addSettingTab(new CardViewSettingTab(this.app, this));

        // Add ribbon icon to toggle between card view and normal file explorer
        this.addRibbonIcon('cards', 'Toggle Card View', () => {
            this.toggleCardView();
        });

        // Add command to toggle card view
        this.addCommand({
            id: 'toggle-card-view',
            name: 'Toggle Card View',
            callback: () => {
                this.toggleCardView();
            }
        });

        // Register for layout change to detect when file explorer is ready
        this.registerEvent(
            this.app.workspace.on('layout-change', () => {
                this.onLayoutChange();
            })
        );

        // Initial setup
        setTimeout(() => {
            this.onLayoutChange();
        }, 2000); // Give Obsidian time to load the file explorer
    }

    onunload() {
        console.log('Unloading Card View Plugin');
        
        // Restore original file explorer if we were using card view
        if (this.usingCardView) {
            this.restoreFileExplorer();
        }
    }
    
    onLayoutChange() {
        // Check if file explorer exists and we need to replace it with card view
        if (this.settings.replaceFileExplorer && !this.usingCardView) {
            this.replaceFileExplorer();
        }
    }
    
    toggleCardView() {
        if (this.usingCardView) {
            this.restoreFileExplorer();
            this.usingCardView = false;
        } else {
            this.replaceFileExplorer();
            this.usingCardView = true;
        }
    }
    
    async replaceFileExplorer() {
        // Find file explorer leaf
        const fileExplorerLeaves = this.app.workspace.getLeavesOfType('file-explorer');
        
        if (fileExplorerLeaves.length === 0) {
            // No file explorer found, try to create one in the left sidebar
            const leaf = this.app.workspace.getLeftLeaf(false);
            await leaf.setViewState({ type: CARD_VIEW_TYPE });
            this.usingCardView = true;
            return;
        }
        
        // Replace the first file explorer leaf with our card view
        const explorerLeaf = fileExplorerLeaves[0];
        await explorerLeaf.setViewState({ type: CARD_VIEW_TYPE });
        this.app.workspace.revealLeaf(explorerLeaf);
        this.usingCardView = true;
    }
    
    async restoreFileExplorer() {
        // Find our card view leaves
        const cardViewLeaves = this.app.workspace.getLeavesOfType(CARD_VIEW_TYPE);
        
        if (cardViewLeaves.length === 0) {
            return;
        }
        
        // Replace our card view with the file explorer
        const cardLeaf = cardViewLeaves[0];
        await cardLeaf.setViewState({ type: 'file-explorer' });
        this.app.workspace.revealLeaf(cardLeaf);
        this.usingCardView = false;
    }

    async loadSettings() {
        this.settings = Object.assign({}, {
            showDate: true,
            showPreview: true,
            previewLength: 100,
            sortBy: 'mtime', // mtime, ctime, name
            sortDirection: 'desc', // asc, desc
            cardWidth: 250,
            cardHeight: 150,
            cardSpacing: 10,
            dateFormat: 'MMM D, YYYY',
            replaceFileExplorer: true, // New setting to replace the file explorer
            showBreadcrumbs: false,    // Show navigation breadcrumbs
            showFolders: false,        // Show folders as special items
            showAllFilesAtRoot: true   // Show all files at root level, not just root files
        }, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async activateView() {
        const { workspace } = this.app;
        
        // Check if view already exists
        const existing = workspace.getLeavesOfType(CARD_VIEW_TYPE);
        
        if (existing.length) {
            // View exists, just reveal it
            workspace.revealLeaf(existing[0]);
            return;
        }

        // Create and reveal a new leaf
        const leaf = workspace.getLeaf('tab');
        await leaf.setViewState({
            type: CARD_VIEW_TYPE,
            active: true,
        });
        
        workspace.revealLeaf(leaf);
    }
}

// Define the settings tab
class CardViewSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Card View Settings' });

        // File Explorer Integration Section
        containerEl.createEl('h3', { text: 'File Explorer Integration' });

        new Setting(containerEl)
            .setName('Replace File Explorer')
            .setDesc('Replace the default file explorer with card view when enabled')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.replaceFileExplorer)
                .onChange(async (value) => {
                    this.plugin.settings.replaceFileExplorer = value;
                    await this.plugin.saveSettings();
                    
                    // Apply change immediately
                    if (value) {
                        this.plugin.replaceFileExplorer();
                    } else {
                        this.plugin.restoreFileExplorer();
                    }
                }));

        new Setting(containerEl)
            .setName('Show Breadcrumbs')
            .setDesc('Show folder navigation breadcrumbs at the top of the card view')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showBreadcrumbs)
                .onChange(async (value) => {
                    this.plugin.settings.showBreadcrumbs = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Show Folders')
            .setDesc('Display folders as navigable items in the card view')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showFolders)
                .onChange(async (value) => {
                    this.plugin.settings.showFolders = value;
                    await this.plugin.saveSettings();
                }));
                
        new Setting(containerEl)
            .setName('Show All Files at Root')
            .setDesc('Show all files in the vault at root level instead of just files in the root folder')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showAllFilesAtRoot)
                .onChange(async (value) => {
                    this.plugin.settings.showAllFilesAtRoot = value;
                    await this.plugin.saveSettings();
                }));

        // Card Display Section
        containerEl.createEl('h3', { text: 'Card Display' });

        new Setting(containerEl)
            .setName('Show Date')
            .setDesc('Show creation or modification date at the bottom of each card')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showDate)
                .onChange(async (value) => {
                    this.plugin.settings.showDate = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Show Preview')
            .setDesc('Show a preview of note content in each card')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showPreview)
                .onChange(async (value) => {
                    this.plugin.settings.showPreview = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Preview Length')
            .setDesc('Number of characters to show in the preview')
            .addSlider(slider => slider
                .setLimits(50, 500, 50)
                .setValue(this.plugin.settings.previewLength)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.previewLength = value;
                    await this.plugin.saveSettings();
                }));

        // Sorting Section
        containerEl.createEl('h3', { text: 'Sorting' });

        new Setting(containerEl)
            .setName('Sort By')
            .setDesc('Sort cards by this property')
            .addDropdown(dropdown => dropdown
                .addOption('mtime', 'Last Modified')
                .addOption('ctime', 'Created Time')
                .addOption('name', 'File Name')
                .setValue(this.plugin.settings.sortBy)
                .onChange(async (value) => {
                    this.plugin.settings.sortBy = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Sort Direction')
            .setDesc('Sort direction')
            .addDropdown(dropdown => dropdown
                .addOption('desc', 'Newest First')
                .addOption('asc', 'Oldest First')
                .setValue(this.plugin.settings.sortDirection)
                .onChange(async (value) => {
                    this.plugin.settings.sortDirection = value;
                    await this.plugin.saveSettings();
                }));

        // Card Layout Section
        containerEl.createEl('h3', { text: 'Card Layout' });

        new Setting(containerEl)
            .setName('Card Width')
            .setDesc('Width of each card in pixels')
            .addSlider(slider => slider
                .setLimits(150, 500, 10)
                .setValue(this.plugin.settings.cardWidth)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.cardWidth = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Card Height')
            .setDesc('Height of each card in pixels')
            .addSlider(slider => slider
                .setLimits(100, 400, 10)
                .setValue(this.plugin.settings.cardHeight)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.cardHeight = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Card Spacing')
            .setDesc('Space between cards in pixels')
            .addSlider(slider => slider
                .setLimits(5, 30, 1)
                .setValue(this.plugin.settings.cardSpacing)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.cardSpacing = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Date Format')
            .setDesc('Format for displaying dates (using moment.js syntax)')
            .addText(text => text
                .setValue(this.plugin.settings.dateFormat)
                .onChange(async (value) => {
                    this.plugin.settings.dateFormat = value;
                    await this.plugin.saveSettings();
                }));
    }
}

// Define the card view
class CardView extends ItemView {
    constructor(leaf, plugin) {
        super(leaf);
        this.plugin = plugin;
        this.currentFolder = '';
        this.searchTerm = '';
    }

    getViewType() {
        return CARD_VIEW_TYPE;
    }

    getDisplayText() {
        return 'Card View';
    }

    getIcon() {
        return 'folder';
    }

    async onOpen() {
        this.contentEl.empty();
        this.contentEl.addClass('card-view-container');

        // Create header with controls
        const headerEl = this.contentEl.createEl('div', { cls: 'card-view-header' });
        
        // Create breadcrumbs navigation (if enabled)
        if (this.plugin.settings.showBreadcrumbs) {
            this.breadcrumbsEl = headerEl.createEl('div', { cls: 'card-view-breadcrumbs' });
            this.updateBreadcrumbs();
        }
        
        // Create control bar
        const controlsEl = headerEl.createEl('div', { cls: 'card-view-controls' });
        
        // Add search box
        this.searchEl = controlsEl.createEl('input', { 
            cls: 'card-view-search',
            type: 'text',
            placeholder: 'Search...'
        });
        
        this.searchEl.addEventListener('input', () => {
            this.searchTerm = this.searchEl.value;
            this.renderContent();
        });

        // Add new note button
        const newNoteBtn = controlsEl.createEl('button', { 
            cls: 'card-view-new-note',
            text: 'New Note'
        });
        
        newNoteBtn.addEventListener('click', () => {
            this.createNewNote(this.currentFolder);
        });

        // Create container for cards
        this.cardsContainerEl = this.contentEl.createEl('div', { cls: 'card-view-cards' });
        
        // Initial render of current folder
        this.renderContent();
    }

    updateBreadcrumbs() {
        if (!this.breadcrumbsEl) return;
        
        this.breadcrumbsEl.empty();
        
        // Add root link
        const rootLink = this.breadcrumbsEl.createEl('span', { 
            cls: 'card-view-breadcrumb-item',
            text: 'Root'
        });
        
        rootLink.addEventListener('click', () => {
            this.navigateToFolder('');
        });
        
        // If we're at root, we're done
        if (!this.currentFolder) return;
        
        // Add separator
        this.breadcrumbsEl.createEl('span', { 
            cls: 'card-view-breadcrumb-separator',
            text: ' / '
        });
        
        // Split path and create breadcrumbs for each level
        const parts = this.currentFolder.split('/');
        let currentPath = '';
        
        parts.forEach((part, index) => {
            // Build the path up to this point
            if (index > 0) {
                currentPath += '/';
            }
            currentPath += part;
            
            // Create the breadcrumb item for this level
            const linkEl = this.breadcrumbsEl.createEl('span', { 
                cls: 'card-view-breadcrumb-item',
                text: part
            });
            
            // Make it clickable to navigate to this folder level
            linkEl.addEventListener('click', () => {
                this.navigateToFolder(currentPath);
            });
            
            // Add separator for next level (if not the last one)
            if (index < parts.length - 1) {
                this.breadcrumbsEl.createEl('span', { 
                    cls: 'card-view-breadcrumb-separator',
                    text: ' / '
                });
            }
        });
    }

    async navigateToFolder(folderPath) {
        this.currentFolder = folderPath;
        this.updateBreadcrumbs();
        this.renderContent();
    }

    async renderContent() {
        // Reset search box if folder changed
        if (this.searchEl && this.searchEl.value !== this.searchTerm) {
            this.searchEl.value = this.searchTerm;
        }
        
        // Clear current content
        this.cardsContainerEl.empty();
        
        // Apply card styling
        const { settings } = this.plugin;
        this.cardsContainerEl.style.setProperty('--card-width', settings.cardWidth + 'px');
        this.cardsContainerEl.style.setProperty('--card-height', settings.cardHeight + 'px');
        this.cardsContainerEl.style.setProperty('--card-spacing', settings.cardSpacing + 'px');
        
        // Render folders first if enabled (and not at root level)
        if (settings.showFolders && this.currentFolder !== '') {
            await this.renderFolders();
        }
        
        // Then render files
        await this.renderFiles();
        
        // Debug info to help diagnose issues
        const fileCount = await this.countFiles();
        console.log(`Card View: Found ${fileCount} files in vault, rendering from folder: "${this.currentFolder}"`);
    }
    
    async countFiles() {
        return this.app.vault.getMarkdownFiles().length;
    }
    
    async renderFolders() {
        const { vault } = this.app;
        
        // Get all folders in current path
        const folders = this.getFolders().filter(folder => {
            // Only direct children of current folder
            if (!this.currentFolder) {
                // Root level - get folders without /
                return !folder.includes('/');
            } else {
                // Subfolders - must start with current folder path and have only one additional level
                return folder.startsWith(this.currentFolder + '/') && 
                       folder.substring(this.currentFolder.length + 1).indexOf('/') === -1;
            }
        });
        
        // Filter by search term if provided
        const filteredFolders = this.searchTerm 
            ? folders.filter(folder => {
                const folderName = folder.split('/').pop();
                return folderName.toLowerCase().includes(this.searchTerm.toLowerCase());
            })
            : folders;
        
        // Render folder cards
        for (const folder of filteredFolders) {
            const folderName = folder.split('/').pop();
            
            // Create folder card
            const cardEl = this.cardsContainerEl.createEl('div', { 
                cls: 'card-view-card card-view-folder' 
            });
            
            // Add folder icon and title
            const titleEl = cardEl.createEl('div', { cls: 'card-view-title' });
            titleEl.innerHTML = `<svg class="folder-icon" viewBox="0 0 100 100" width="20" height="20"><path fill="currentColor" d="M89,20H50l-7.8-7.8C40.8,10.8,38.4,10,36,10H11c-3.3,0-6,2.7-6,6v68c0,3.3,2.7,6,6,6h78c3.3,0,6-2.7,6-6V26C95,22.7,92.3,20,89,20z"></path></svg> ${folderName}`;
            
            // Add folder content preview
            const previewEl = cardEl.createEl('div', { cls: 'card-view-preview' });
            
            // Count files in this folder
            const fileCount = vault.getMarkdownFiles().filter(file => 
                file.parent && file.parent.path === folder
            ).length;
            
            previewEl.setText(`${fileCount} files`);
            
            // Make folder clickable
            cardEl.addEventListener('click', () => {
                this.navigateToFolder(folder);
            });
        }
    }
    
    getFolders() {
        const { vault } = this.app;
        const folders = new Set();
        
        // Get all files
        vault.getAllLoadedFiles().forEach(file => {
            if (file.parent && file.parent.path) {
                folders.add(file.parent.path);
            }
        });
        
        return Array.from(folders).sort();
    }
    
    async renderFiles() {
        const { vault } = this.app;
        const { settings } = this.plugin;
        
        // Get all markdown files
        let files;
        
        // Determine which files to show based on settings and current folder
        if (this.currentFolder === '') {
            if (settings.showAllFilesAtRoot) {
                // Show ALL files in vault at root level
                files = vault.getMarkdownFiles();
            } else {
                // Show only files that are directly in the root folder
                files = vault.getMarkdownFiles().filter(file => {
                    return !file.parent || file.parent.path === '';
                });
            }
        } else {
            // For subfolders, show only files in that folder
            files = vault.getMarkdownFiles().filter(file => {
                return file.parent && file.parent.path === this.currentFolder;
            });
        }
        
        // Filter by search term if provided
        const filteredFiles = this.searchTerm 
            ? files.filter(file => file.basename.toLowerCase().includes(this.searchTerm.toLowerCase()))
            : files;
        
        // Sort files based on settings
        const sortedFiles = await this.sortFiles(filteredFiles);
        
        console.log(`Card View: Rendering ${sortedFiles.length} files`);
        
        // Create cards for each file
        for (const file of sortedFiles) {
            // Create card element
            const cardEl = this.cardsContainerEl.createEl('div', { cls: 'card-view-card' });
            
            // Add title
            cardEl.createEl('div', { 
                cls: 'card-view-title',
                text: file.basename
            });
            
            // // Add path/location if not in the root folder view
            // if (this.currentFolder === '' && file.parent && file.parent.path && file.parent.path.trim() !== '') {
            //     cardEl.createEl('div', { 
            //         cls: 'card-view-path',
            //         text: file.parent.path
            //     });
            // }
            
            // Add preview if enabled
            if (settings.showPreview) {
                const previewEl = cardEl.createEl('div', { cls: 'card-view-preview' });
                
                try {
                    // Get file content
                    const content = await vault.cachedRead(file);
                    
                    // Clean content (remove markdown, etc)
                    const cleanContent = this.cleanContent(content);
                    
                    // Truncate to preview length
                    const preview = cleanContent.length > settings.previewLength
                        ? cleanContent.substring(0, settings.previewLength) + '...'
                        : cleanContent;
                        
                    previewEl.setText(preview);
                } catch (error) {
                    previewEl.setText('Error loading preview');
                }
            }
            
            // Add date if enabled
            if (settings.showDate) {
                const stat = await vault.adapter.stat(file.path);
                const date = settings.sortBy === 'ctime' 
                    ? stat.ctime 
                    : stat.mtime;
                
                cardEl.createEl('div', { 
                    cls: 'card-view-date',
                    text: window.moment(date).format(settings.dateFormat)
                });
            }
            
            // Make card clickable to open note
            cardEl.addEventListener('click', async (event) => {
                // Only if the click is on the card itself, not a button inside it
                if (event.target === cardEl || event.target.parentElement === cardEl) {
                    const leaf = this.app.workspace.getLeaf('tab');
                    await leaf.openFile(file);
                }
            });
        }
    }

    async sortFiles(files) {
        const { settings } = this.plugin;
        const { sortBy, sortDirection } = settings;
        
        // For name sorting, we can do it synchronously
        if (sortBy === 'name') {
            return files.sort((a, b) => {
                const valueA = a.basename.toLowerCase();
                const valueB = b.basename.toLowerCase();
                
                const direction = sortDirection === 'asc' ? 1 : -1;
                
                if (valueA < valueB) return -1 * direction;
                if (valueA > valueB) return 1 * direction;
                return 0;
            });
        }
        
        // For date sorting, we need to get file stats
        const fileStats = await Promise.all(files.map(async (file) => {
            const stat = await this.app.vault.adapter.stat(file.path);
            return {
                file,
                date: sortBy === 'ctime' ? stat.ctime : stat.mtime
            };
        }));
        
        // Sort by date
        fileStats.sort((a, b) => {
            const direction = sortDirection === 'asc' ? 1 : -1;
            return (a.date - b.date) * direction;
        });
        
        // Return just the files in sorted order
        return fileStats.map(item => item.file);
    }

    async createNewNote(folderPath = '') {
        const { vault } = this.app;
        
        // Generate a new note name
        const newNoteName = 'New Note ' + moment().format('YYYY-MM-DD HH:mm:ss');
        
        // Create path for the new note
        let path = newNoteName + '.md';
        if (folderPath) {
            path = folderPath + '/' + path;
        }
        
        try {
            // Create the file
            const newFile = await vault.create(path, '');
            
            // Open the new file
            const leaf = this.app.workspace.getLeaf('tab');
            await leaf.openFile(newFile);
            
            // Refresh the card view
            this.renderContent();
        } catch (error) {
            console.error('Error creating new note:', error);
        }
    }

    cleanContent(content) {
        // Remove markdown syntax
        return content
            .replace(/!\[\[.*?\]\]/g, '') // Remove embedded images
            .replace(/\[\[.*?\]\]/g, '') // Remove internal links
            .replace(/#{1,6}\s+.*?\n/g, '') // Remove headings
            .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
            .replace(/\*(.*?)\*/g, '$1') // Remove italic
            .replace(/~~(.*?)~~/g, '$1') // Remove strikethrough
            .replace(/`(.*?)`/g, '$1') // Remove inline code
            .replace(/```.*?```/gs, '') // Remove code blocks
            .replace(/>(.*?)\n/g, '') // Remove blockquotes
            .replace(/- \[ ] /g, '') // Remove task list markers
            .replace(/- \[x] /g, '') // Remove completed task list markers
            .replace(/^\s*- /gm, '') // Remove list markers
            .replace(/^\s*\d+\. /gm, '') // Remove ordered list markers
            .trim();
    }

    async onClose() {
        // Clean up when the view is closed
        this.contentEl.empty();
    }
}

module.exports = CardViewPlugin;