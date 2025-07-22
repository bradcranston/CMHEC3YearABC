# Sales Reporting Interface

This interface creates a comprehensive sales report from FileMaker data with filtering, grouping, and ranking capabilities.

## Features

- **User Filtering**: Dropdown to filter report by sales user
- **Account Ranking**: Automatically categorizes accounts into A, B, C rankings based on total sales
  - **Rank A**: Accounts with >$30,000 total sales
  - **Rank B**: Accounts with $3,000-$30,000 total sales  
  - **Rank C**: Accounts with <$3,000 total sales
- **Multi-Year Analysis**: Shows data for 2025, 2024, 2023 with totals
- **Summary Statistics**: Displays total sales, total margin, and number of sales for each year
- **Responsive Design**: Works on desktop and mobile devices

## FileMaker Integration

### Main Function

The interface exposes a global function that FileMaker can call:

```javascript
window.generateReport(data)
```

### Data Format

The function expects data in the following format (matching your FileMaker OData structure):

```json
{
  "value": [
    {
      "Account": "Company Name",
      "Account_ID": "unique_id",
      "Date": "2023-01-03",
      "Profit": 1324.69,
      "Total": 6171.75,
      "User": "User Name"
    }
  ]
}
```

Or directly as an array:

```json
[
  {
    "Account": "Company Name",
    "Account_ID": "unique_id", 
    "Date": "2023-01-03",
    "Profit": 1324.69,
    "Total": 6171.75,
    "User": "User Name"
  }
]
```

### FileMaker Script Examples

#### Option 1: Pass as JSON String
```javascript
// In FileMaker Web Viewer
var jsonData = JSON.stringify(yourDataArray);
generateReport(jsonData);
```

#### Option 2: Pass as Object
```javascript
// In FileMaker Web Viewer
generateReport(yourDataObject);
```

#### Option 3: Using FileMaker Script
```
Set Variable [$json; Value:JSONGetElement(yourData)]
Set Web Viewer [Object Name: "reportViewer"; URL: "javascript:generateReport(" & $json & ");"]
```

## Report Structure

The report is organized into three main sections (A, B, C rankings), each containing:

### Column Structure
- **Account Name**: The unique account name
- **Year Columns** (2025, 2024, 2023): For each year:
  - Total Sales (sum of Total field)
  - Total Margin (sum of Profit field)  
  - # Sales (count of records)
- **3-Year Total Columns**:
  - Total Sales across all years
  - Total Margin across all years
  - Total # Sales across all years

### Summary Rows
Each ranking section includes a summary row showing totals for that ranking level.

## Usage

1. **Load the interface** in a FileMaker Web Viewer
2. **Call the function** with your sales data
3. **Use the filter** to view specific users' data
4. **Review rankings** to see account performance tiers

## Development

- **HTML**: `index.html` - Main page structure
- **CSS**: `src/style.css` - Styling and responsive design
- **JavaScript**: `src/index.js` - Data processing and report generation
- **Sample Data**: `data.json` - Test data for development

## Testing

The interface automatically loads sample data from `data.json` when accessed directly. For production use with FileMaker, call the `generateReport()` function with your actual data.
