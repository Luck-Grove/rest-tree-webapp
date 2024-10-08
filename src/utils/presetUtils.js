export const fetchXMLPresets = async () => {
    try {
        const response = await fetch('/rest-tree-webapp/ArcGIS Server List.xml');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const xmlText = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        
        const connections = xmlDoc.getElementsByTagName('arcgisfeatureserver');
        const newPresets = Array.from(connections).map(connection => ({
            name: connection.getAttribute('name'),
            url: connection.getAttribute('url')
        }));
        
        return newPresets;
    } catch (error) {
        console.error('Error loading XML presets:', error);
        throw error;
    }
};

export const handlePresetChange = (e, setSelectedPreset, setUrl) => {
    const selectedUrl = e.target.value;
    setSelectedPreset(selectedUrl);
    setUrl(selectedUrl);
};

export const handlePresetInputChange = (e, setSelectedPreset, presets, setFilteredPresets, setShowPresetDropdown, setHighlightedIndex) => {
    const input = e.target.value;
    setSelectedPreset(input);
    
    if (input.length > 0) {
        const normalizedInput = normalizeString(input);
        const filtered = presets.filter(preset => 
            normalizeString(preset.name).includes(normalizedInput) ||
            normalizeString(preset.url).includes(normalizedInput)
        );
        setFilteredPresets(filtered);
    } else {
        setFilteredPresets(presets);
    }
    setShowPresetDropdown(true);
    setHighlightedIndex(-1);
};

export const handlePresetSelect = (preset, setSelectedPreset, setUrl, setShowPresetDropdown, setHighlightedIndex) => {
    setSelectedPreset(preset.name);
    setUrl(preset.url);
    setShowPresetDropdown(false);
    setHighlightedIndex(-1);
};

export const handlePresetInputFocus = (setFilteredPresets, presets, setShowPresetDropdown, setHighlightedIndex) => {
    setFilteredPresets(presets);
    setShowPresetDropdown(true);
    setHighlightedIndex(-1);
};

const normalizeString = (str) => {
    return str.toLowerCase().replace(/[^a-z0-9]/g, '');
};