import fs from "node:fs";
import readline from "node:readline";
import { stdin, stdout } from "node:process";

// Types representing the structure of a report and a report row
export type Report = {
  [key: string]: ReportRow;
};

export type ReportRow = {
  displayTxt: string; // Text to display for the row (e.g., clearance, normal)
  count: number; // Count of the products in this category
  min: number; // Minimum price of the products in this category
  max?: number; // Optional maximum price (only if prices vary)
};

// Row types that indicate the type of data being processed
export type RowType = "Type" | "Product";

// Constants for timeout delay and minimum product quantity to be included in the report
const TIMEOUT_DELAY_MS = 100;
const QUANTITY_MINIMUM = 3;

// Default report structure, initialized with three categories: clearance, normal, price_in_cart
export const REPORT_DEFAULTS: Report = {
  clearance: { displayTxt: "clearance", count: 0, min: 0 },
  normal: { displayTxt: "normal", count: 0, min: 0 },
  price_in_cart: { displayTxt: "price_in_cart", count: 0, min: 0 },
};

// Utility Functions

// Sort report rows by count in descending order
export const sortReportRows = (rowA: ReportRow, rowB: ReportRow): number =>
  rowB.count - rowA.count;

// Format a single report row for display, showing the count and price range (min-max)
export const formatRow = (row: ReportRow): string => {
  return `${row.displayTxt}: ${row.count} products${
    row.count
      ? ` @ $${row.min.toFixed(2)}${
          row.max && row.max !== row.min ? `-$${row.max.toFixed(2)}` : ""
        }`
      : ""
  }`;
};

// Output the sorted and formatted report to stdout
export const displayReport = (report: Report): void => {
  const reportRows = Object.values(report).sort(sortReportRows).map(formatRow);
  stdout.write(reportRows.join("\n") + "\n");
};

// Domain Logic

// Update the minimum and maximum price of a report row based on the current product's price
export const updatePriceRange = (price: number, row: ReportRow): ReportRow => {
  row.min = row.min === 0 || row.min > price ? price : row.min;
  if (!row.max || row.max < price) {
    row.max = row.max === undefined || row.max < price ? price : row.max;
  }
  return row;
};

// Update the report with display text for a specific category (e.g., "normal", "clearance")
export const handleTypeRow = (cols: string[], report: Report): void => {
  const [_, key, displayTxt] = cols;
  report[key].displayTxt = displayTxt;
};

// Process a product row, updating the report with product prices and quantities
export const handleProductRow = (cols: string[], report: Report): void => {
  const [, normalPriceStr, clearancePriceStr, quantityStr, priceInCartStr] =
    cols;
  const quantity = parseInt(quantityStr, 10);
  const priceInCart = priceInCartStr === "true";

  // Only consider products with a quantity greater than or equal to the QUANTITY_MINIMUM
  if (quantity >= QUANTITY_MINIMUM) {
    const normalPrice = parseFloat(normalPriceStr);
    const clearancePrice = parseFloat(clearancePriceStr);

    // If the product is on clearance, update the clearance report row
    if (clearancePrice < normalPrice) {
      report.clearance.count++;
      updatePriceRange(clearancePrice, report.clearance);
    }

    // If the product has the same price as normal, update the normal report row
    if (clearancePrice === normalPrice) {
      report.normal.count++;
      updatePriceRange(normalPrice, report.normal);
    }

    // If the price is only available in the cart, update the price_in_cart report row
    if (priceInCart) {
      report.price_in_cart.count++;
      updatePriceRange(clearancePrice, report.price_in_cart);
    }
  }
};

// Process a single line of input, determining whether it's a Type or Product row, and update the report
export const processLine = (line: string, report: Report): Report => {
  const cols = line.split(",");
  const rowType = cols[0] as RowType;

  if (rowType === "Type") {
    handleTypeRow(cols, report);
  } else if (rowType === "Product") {
    handleProductRow(cols, report);
  }

  return report;
};

// Input Handling

// Set up a readline interface to read from a file or stdin depending on the input
export const setupReadlineInterface = (
  filePath?: string
): readline.Interface => {
  if (filePath) {
    const fileStream = fs.createReadStream(filePath);
    fileStream.on("error", (error) => console.error(error.message));
    return readline.createInterface({ input: fileStream });
  } else {
    return readline.createInterface({ input: stdin });
  }
};

// Main Function

// Entry point for the application, handling input from a file or stdin, and processing each line
export function main(): void {
  const filePath = process.argv[2];
  const hasFileInput = filePath && !filePath.startsWith("-");
  const hasStdInput = !stdin.isTTY; // hack to determin if stdin is providing data

  // If no input source is provided, log an error and exit
  if (!hasFileInput && !hasStdInput) {
    console.error("No input provided");
    return;
  }

  // Create a deep copy of the default report structure
  const report: Report = JSON.parse(JSON.stringify(REPORT_DEFAULTS));
  const rl = setupReadlineInterface(hasFileInput ? filePath : undefined);
  let timeoutId: NodeJS.Timeout | null = null;

  // Set a timeout for stdin input to prevent hanging if no data is received
  if (hasStdInput) {
    timeoutId = setTimeout(() => {
      stdin.destroy();
      console.error("No stdin data");
    }, TIMEOUT_DELAY_MS);
  }

  // Process each line of input, updating the report
  rl.on("line", (line) => {
    processLine(line, report);
    if (timeoutId) clearTimeout(timeoutId);
  });

  // When all input is processed, display the final report
  rl.on("close", () => displayReport(report));
}

// Run the main function when the script is executed
main();
