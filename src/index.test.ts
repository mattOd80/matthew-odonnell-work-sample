import fs from "fs";
import readline from "node:readline";

import { describe, test, expect } from "@jest/globals";
import mockStdin from "mock-stdin";
import {
  ReportRow,
  REPORT_DEFAULTS,
  main,
  processLine,
  updatePriceRange,
  sortReportRows,
  formatRow,
} from ".";

describe("Line processing", () => {
  const mock = {
    type: `Type,normal,NORMAL`,
    product_normal: `Product,99.99,99.99,10,false`,
    product_clearance: `Product,99.99,1.00,10,false`,
    product_clearance_price_in_cart: `Product,100.00,50.00,10,true`,
    product_clearance_price_in_cart_more_max: `Product,110.00,55.00,10,true`,
    product_normal_low_stock: `Product,100.00,0.99,1,true`,
  };
  test("Type display text updates", () => {
    const res = processLine(mock.type, REPORT_DEFAULTS);
    expect(res.normal.displayTxt).toEqual("NORMAL");
  });

  test("Normal price product updates min", () => {
    const res = processLine(mock.product_normal, REPORT_DEFAULTS);
    expect(res.normal).toEqual({
      displayTxt: "NORMAL",
      count: 1,
      min: 99.99,
      max: 99.99,
    });
    expect(res.price_in_cart.count).toEqual(0);
  });

  test("Clearance price product updates min", () => {
    const res = processLine(mock.product_clearance, REPORT_DEFAULTS);
    expect(res.clearance).toEqual({
      displayTxt: "clearance",
      count: 1,
      min: 1.0,
      max: 1.0,
    });
  });

  test("Clearance price only in cart and increment", () => {
    const res = processLine(
      mock.product_clearance_price_in_cart,
      REPORT_DEFAULTS
    );
    expect(res.clearance).toEqual({
      displayTxt: "clearance",
      count: 2,
      min: 1.0,
      max: 50.0,
    });
    expect(res.price_in_cart).toEqual({
      displayTxt: "price_in_cart",
      count: 1,
      min: 50.0,
      max: 50.0,
    });
  });

  test("Clearance price only in cart and increment with higher max", () => {
    const res = processLine(
      mock.product_clearance_price_in_cart_more_max,
      REPORT_DEFAULTS
    );
    expect(res.clearance).toEqual({
      displayTxt: "clearance",
      count: 3,
      min: 1.0,
      max: 55.0,
    });
    expect(res.price_in_cart).toEqual({
      displayTxt: "price_in_cart",
      count: 2,
      min: 50.0,
      max: 55.0,
    });
  });

  test("Normal price product below minimum stock ignored", () => {
    const res = processLine(mock.product_normal_low_stock, REPORT_DEFAULTS);
    expect(res.normal).toEqual({
      displayTxt: "NORMAL",
      count: 1,
      min: 99.99,
      max: 99.99,
    });
    expect(res.price_in_cart.count).toEqual(2);
  });

  test("updates min when a lower price is found", () => {
    const row = { displayTxt: "clearance", count: 1, min: 50.0 };
    const updatedRow = updatePriceRange(30.0, row);
    expect(updatedRow.min).toEqual(30.0);
  });

  test("updates max when a higher price is found", () => {
    const row = { displayTxt: "clearance", count: 1, min: 30.0, max: 50.0 };
    const updatedRow = updatePriceRange(60.0, row);
    expect(updatedRow.max).toEqual(60.0);
  });

  test("does not update min or max when no lower or higher price is found", () => {
    const row = { displayTxt: "clearance", count: 1, min: 30.0, max: 50.0 };
    const updatedRow = updatePriceRange(40.0, row);
    expect(updatedRow.min).toEqual(30.0);
    expect(updatedRow.max).toEqual(50.0);
  });

  test("sets max when max is undefined", () => {
    const row = {
      displayTxt: "clearance",
      count: 1,
      min: 30.0,
      max: undefined,
    };
    const updatedRow = updatePriceRange(40.0, row);
    expect(updatedRow.max).toEqual(40.0);
  });

  test("ignores lines that do not conform to expected format", () => {
    const invalidLine = "Invalid line with missing fields";
    const res = processLine(invalidLine, REPORT_DEFAULTS);
    expect(res).toEqual(REPORT_DEFAULTS); // Expect no changes
  });

  test("ignores lines with non-numeric price or quantity", () => {
    const invalidProductLine = "Product,abc,49.99,xyz,false";
    const res = processLine(invalidProductLine, REPORT_DEFAULTS);
    expect(res).toEqual(REPORT_DEFAULTS); // Expect no changes
  });

  test("ignores lines with missing columns", () => {
    const invalidProductLine = "Product,59.99,39.99"; // Missing quantity and in-cart fields
    const res = processLine(invalidProductLine, REPORT_DEFAULTS);
    expect(res).toEqual(REPORT_DEFAULTS); // Expect no changes
  });
});

describe("Report cosmetics", () => {
  test("sorts by count desc", () => {
    const mockRows = [
      { count: 6 },
      { count: 2 },
      { count: 0 },
      { count: 1 },
      { count: 6 },
    ] as ReportRow[];

    expect(mockRows.sort(sortReportRows)).toEqual([
      { count: 6 },
      { count: 6 },
      { count: 2 },
      { count: 1 },
      { count: 0 },
    ]);
  });

  test("apply data to template", () => {
    const mockReport = {
      clearance: {
        displayTxt: "Clearance Price",
        count: 4,
        min: 10.0,
        max: 100.09,
      },
      normal: { displayTxt: "Normal Price", count: 1, min: 50.0 },
      price_in_cart: { displayTxt: "Price in cart", count: 0, min: 0 },
    };

    expect(formatRow(mockReport.clearance)).toEqual(
      "Clearance Price: 4 products @ $10.00-$100.09"
    );
    expect(formatRow(mockReport.normal)).toEqual(
      "Normal Price: 1 products @ $50.00"
    );
    expect(formatRow(mockReport.price_in_cart)).toEqual(
      "Price in cart: 0 products"
    );
  });
});

describe("Report input/output", () => {
  let originalArgv: string[];
  const mockData = `Type,normal,Normal Price
  Type,clearance,Clearance Price
  Type,price_in_cart,Price In Cart
  Product,59.99,39.98,10,false
  Product,49.99,49.99,8,false
  Product,79.99,49.98,5,true`;

  beforeEach(() => {
    originalArgv = [...process.argv];
    jest.useFakeTimers();
  });

  afterEach(() => {
    process.argv = originalArgv;
    jest.restoreAllMocks(); // Reset any mock after each test
    jest.useRealTimers();
  });

  test("loading data from file", () => {
    jest.replaceProperty(process, "argv", ["...", "...", "DataSample.txt"]);
    const spy = jest.spyOn(fs, "createReadStream");
    main();
    expect(spy).toBeCalledWith("DataSample.txt");
  });

  test("loading data from file fails", () => {
    jest.replaceProperty(process, "argv", ["...", "...", "NOFILE.txt"]);
    const spy = jest.spyOn(fs, "createReadStream");
    main();
    expect(spy).toBeCalledWith("NOFILE.txt");
  });

  test("loading data from stdin", () => {
    jest.replaceProperty(process, "argv", ["...", "...", "--NO-FILEPATH"]);
    const spy = jest.spyOn(readline, "createInterface");
    const stdin = mockStdin.stdin();
    main();
    stdin.send(mockData);
    stdin.end();
    expect(spy).toBeCalledWith({ input: stdin });
  });
});
