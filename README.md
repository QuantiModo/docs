# QuantiModo API

See our interactive API explorer at [https://app.quantimo.do/api/docs](https://app.quantimo.do/api/docs)

Welcome to QuantiModo API!

QuantiModo makes it easy to retrieve normalized user data from a wide array of devices and applications.
[Learn about QuantiModo](https://app.quantimo.do) or contact us at [help.quantimo.do](https://help.quantimo.do).

Before you get started, you will need to:
* Create an account at [QuantiModo](https://app.quantimo.do)
* Sign in, and add some data at [https://app.quantimo.do/connect](https://app.quantimo.do/connect) to try out the API for yourself
* Create an app to get your client id and secret at [https://app.quantimo.do/api/v2/apps](https://app.quantimo.do/api/v2/apps)
* As long as you're signed in, it will use your browser's cookie for authentication.  However, client applications must use OAuth2 tokens to access the API.

## Example Queries

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

Generally, you'll be retrieving new or updated user data.  To avoid unnecessary API calls, you'll want to store your last refresh time locally.  Initially, it should be set to 0.  Then whenever you make a request to get new data, you should limit the returned results to those updated since your last refresh by appending append `?lastUpdated=(ge)"2013-01-D01T01:01:01"` to your request.

Also for better pagination, you can get link to the records of first, last, next and previous page from response headers:
* ```Total-Count``` - Total number of results for given query
* ```Link-First``` - Link to get first page records
* ```Link-Last``` - Link to get last page records
* ```Link-Prev``` - Link to get previous records set
* ```Link-Next``` - Link to get next records set

Remember, response header will be only sent when the record set is available. e.g. You will not get a ```Link-Last``` & ```Link-Next``` when you query for the last page.

### Sorting Results

To get data sorted by particular field:

```
    /variables?sort=lastUpdated
```

It will sort data in ascending order. For descending order, you can add '-' prefix before field like:
```
    /variables?sort=-lastUpdated
```

### Filter Parameters

Also, many endpoints support various filter parameters. You can filter out your result by specifying filter parameter.

For example, to get all variables within the "Mood" category, you would use:
```
    /variables?category=Mood
```

Here is the complete list of filter parameters by endpoints:

#### /correlations
Parameter | Description                                                                                   
----------|--------------------------------------------------------------------------
cause | Original variable name of the hypothetical cause (a.k.a. explanatory or independent variable) for which the user desires correlations
effect | Original variable name of the hypothetical effect (a.k.a. outcome or dependent variable) for which the user desires correlations
correlationCoefficient | Pearson correlation coefficient between cause and effect after lagging by onset delay and grouping by duration of action
onsetDelay | The number of seconds which pass following a cause measurement before an effect would likely be observed. 
durationOfAction | The time in seconds over which the cause would be expected to exert a measurable effect. We have selected a default value for each variable. This default value may be replaced by a user specified by adjusting their variable user settings. 
lastUpdated | The time that this measurement was last updated in the UTC format "YYYY-MM-DDThh:mm:ss"

#### /measurements
Parameter | Description                                                                                   
----------|----------------------------------------------------------------------
variableName | Name of the variable you want measurements for (supports exact name match only)
source | Name of the source you want measurements for (supports exact name match only)
value | Value of measurement 
lastUpdated | The time that this measurement was created or last updated in the UTC format "YYYY-MM-DDThh:mm:ss"

#### /units
Parameter | Description                                                                                   
----------|--------------------------------------------------------------------------
unitName | Unit Name  (supports exact name match only)
abbreviatedUnitName | Restrict the results to a specific unit by providing the unit abbreviation (supports exact name match only)
categoryName | Restrict the results to a specific unit category by providing the unit category name.

#### /variables
Parameter | Description                                                                                   
----------|--------------------------------------------------------------------------
category | Restrict the results to a specific category by providing the variable category name such as "Nutrients" or "Physique".  A complete list of variable categories can be obtained at the /variableCategories endpoint. 
name | Original name of the variable (supports exact name match only)
lastUpdated | Filter by the last time any of the properties of the variable were changed. Uses UTC format "YYYY-MM-DDThh:mm:ss"
source | The name of the data source that created the variable (supports exact name match only).  So if you have a client application and you only want variables that were last updated by your app, you can include the name of your app here
latestMeasurementTime | Filter variables based on the last time a measurement for them was created or updated in the UTC format "YYYY-MM-DDThh:mm:ss"
numberOfMeasurements | Filter variables by the total number of measurements that they have. This could be used of you want to filter or sort by popularity. 
lastSource | Limit variables to those which measurements were last submitted by a specific source. So if you have a client application and you only want variables that were last updated by your app, you can include the name of your app here. (supports exact name match only)

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
    
#### Like operators
Like operators allow filtering using `LIKE` query. This operator is triggered if exact match operator is used, but value contains `%` sign as the first or last character.

In order to filter records which category that start with `Food`, the following query should be used:

    ?category=Food%
    
#### Negation operator
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
   
