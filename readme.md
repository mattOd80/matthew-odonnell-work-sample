## CLI Report Basics

> requirements: https://github.com/designer-brands/digital-work-sample

This CLI app loads data in a standard format via stdin or from a provided file path. The report displays the number of products for each price type (clearance, normal, and price in cart), with the range of prices by each type. The output is sorted in descending order based on the number of products in each category.

The rules:

- Products are excluded from processing if their stock is less than 3.
- Products are `normal price` if their normal price equals their clearance price.
- Products are `clearance` if their clearance price is lower than the normal price.
- Products marked as `price In cart` are also included in the normal or clearance category, depending on their pricing.

## Install from project root

```bash
npm install
```

## Run tests from project root

```bash
npm test
```

## Running the Application from project root

Load data from file:

```bash
npx ts-node src/index.ts DataSample.txt
```

Load data via stdin:

```bash
cat DataSample.txt | npx ts-node ./src/index.ts
```

### Example Input Format

1. **Product Line**: type, normal price, clearance price, quantity in stock, and if the price is shown in the cart.

   ```
   Product,10.99,9.99,5,true
   ```

2. **Type Line**: type, key, and display text.
   ```
   Type,clearance,Clearance Price
   ```

### Example Output

```
Normal Price: 3 products @ $10.99
Clearance: 2 products @ $8.99-$9.99
Price in cart: 1 products @ $8.99
```

## Core Functionality

1. **Input Handling**:

   - `main`: The entry point of the app.
   - `setupReadlineInterface`: Sets up the `readline` interface for reading data from a file or `stdin`.

2. **Main Processing**:

   - `processLine`: Processes each line of input to update the report.
   - `displayReport`: Compiles and outputs the final report.

3. **Domain Logic**:

   - `updatePriceRange`: Updates the minimum and maximum prices for a given price/product type.
   - `handleTypeRow`: Updates the display text for a price type based on input data.
   - `handleProductRow`: Handles the logic of assigning a product row as clearance, normal, and price in cart depending on pricing and stock quantity.

4. **Utility Functions**:

   - `sortReportRows`: Sorts report rows by product count in descending order.
   - `formatRow`: Formats each report row into a string with the display text, number of products, and price range.

## Trade-offs - room for improvement

1. **Separation of Concerns**:
   The input handling (file reading, stdin processing) is separated from the business logic of product processing. This makes the app more flexible since the input source can change without affecting the core logic but, it adds some complexity in managing input sources.

2. **Role-your-own vs. add dependencies**
   The app handles multiple data input types (file, stdin) and uses the _hack_ `!stdin.isTTY` to determine if the stdin is providing data; `stdin.isTTY` is `undefined` when data is pumping, but also could be `undefined` if TTY is not installed on the host system. This is fragile and needs more investigation. Libraries and toolkits for stdin processing may exit that can offload much of the complexity of loading the data and allow us focus on the domain logic and business needs.

3. **Mutability in Report Updates**:
   The `report` object is updated in place making it easier to maintain state as the data is processed. This introduces mutability and fragility, which could lead to issues if the app grows in complexity. The alternative approach is to be more functional. Instead of updating the `report` object in place, each transformation would return a new report object. While this would improve immutability and testing, it could make the code more difficult to read. But given the current simplicity of the app, that could add complexity without much improvement.

4. **Command Line Options Parsing**:
   A better command-line parser, maybe `yargs` or `commander`, could have been used to handle input arguments, rather than directly parsing `process.argv`. This could provide greater flexibility in extending the CLI, such as adding options for custom timeout durations, changing the default `MIN`, or more filtering. This approach would also introduce dependencies that may not be needed depending on the real-world needs of the app users.

5. **Streaming vs. Buffering Input**:
   The code processes input line by line in a streaming fashion using the `readline` interface. This is efficient for handling large files or continuous streams, but if we know the input will be small and/or fixed in size, buffering the entire input before processing might simplify the code.

6. **Error Handling**:
   More error handling can be added to handle cases like invalid input formats. Another option is adding a validation layer to preprocess the input data before processing it further.

7. **Timeout Handling**:
   A timeout is used to handle cases where no input is received via `stdin` to ensuring the app doesn't hang. There is a potential race condition if the timeout expires just before data is received. Clearing the timeout as soon as input is detected help to prevent that, but other approaches could be taken.
