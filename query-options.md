### Query Options

The standard query options for QuantiModo API are as described in the table below.

These are the available query options in QuantiModo API:

Parameter | Description                                                                                   
----------|--------------------------------------------------------------------------
limit     | The LIMIT is used to limit the number of results returned. So if you have 1000 results, but only want to the first 10, you would set this to 10 and offset to 0.  The maximum limit is 200 records. 
offset    | Suppose you wanted to show results 11-20. You'd set the `offset` to 10 and the `limit` to 10.
sort      | Sort by given field. If the field is prefixed with '-', it will sort in descending order.

### Pagination Conventions

Since the maximum limit is 200 records, to get more than that you'll have to make multiple API calls and page through the results. To retrieve all the data, you can iterate through data by using the `limit` and `offset` query parameters.

For example, if you want to retrieve data from 61-80 then you can use a query with the following parameters,
```
  /variables?limit=20&offset=60
```

Generally, you'll be retrieving new or updated user data.  To avoid unnecessary API calls, you'll want to store your last refresh time locally.  Initially, it should be set to 0.  Then whenever you make a request to get new data, you should limit the returned results to those updated since your last refresh by appending append `?updatedAt=(ge)"2013-01-D01T01:01:01"` to your request.

### Sorting Results

To get data sorted by particular field:

```
    /variables?sort=updatedAt
```

It will sort data in ascending order. For descending order, you can add '-' prefix before field like:
```
    /variables?sort=-updatedAt
```

### Filter Parameters

Also, many endpoints support various filter parameters. You can filter out your result by specifying filter parameter.

For example, to get all variables within the "Mood" category, you would use:
```
    /variables?category=Mood
```

#### Filter operators support

API supports the following operators with filter parameters:

#### Comparison operators
Comparison operators allow you to limit results to those greater than, less than, or equal to a specified value for a specified attribute.   These operators can be used with strings, numbers, and dates. 

The following comparison operators are available:

* `gt` for `greater than` comparison
* `ge` for `greater than or equal` comparison
* `lt` for `less than` comparison, e.g
* `le` for `less than or equal` comparison

They are included in queries using the following format:
    
    (<operator>)<value>

For example, in order to filter value which is greater than 21, the following query parameter should be used:

    ?value=(gt)21
    
#### Equals/In Operators
It also allows filtering by the exact value of an attribute or by a set of values, depending on the type of value passed as a query parameter. 
If the value contains commas, the parameter is split on commas and used as array input for `IN` filtering, otherwise the exact match is applied.
    
In order to only show records which have the value 42, the following query should be used:

    ?value=42
    
In order to filter records which have value 42 or 43, the following query should be used:

    ?value=42,43
    
#### Wildcard Like Operator
To get results matching a substring, add `%` as a wildcard as the first and/or last character of a query string parameter.  In order to filter records which category that start with `Food`, the following query should be used: `?variableCategoryName=Food%`
    
#### Negation Operator
It is possible to get negated results of a query by prefixed the operator with `!`.
    
Some examples:
    
    //filter records except those with value are not 42 or 43
    ?value=!42,43
    
    //filter records with value not greater than 21
    ?value=!(ge)21
    
#### Multiple constraints for single attribute
It is possible to apply multiple constraints by providing an array of query filters:

    // filter all records which value is greater than 20.2 and less than 20.3
    ?value[]=(gt)20.2&value[]=(lt)20.3
    
    // filter all records which value is greater than 20.2 and less than 20.3 but not 20.2778
    ?value[]=(gt)20.2&value[]=(lt)20.3&value[]=!20.2778
   
