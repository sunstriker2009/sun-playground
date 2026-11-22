using System;
using System.Linq;
using System.Text.Json;
using System.Xml.Linq;
using System.Xml.XPath;

var suite = JsonSerializer.Deserialize<TestSuite>(Console.OpenStandardInput())
    ?? throw new InvalidOperationException("Expected XPath test cases on standard input.");
var document = XDocument.Parse(suite.Xml, LoadOptions.PreserveWhitespace);

foreach (var test in suite.Cases)
{
    var actualIds = document.XPathSelectElements(test.Expression)
        .Select(element => (string?)element.Attribute("id"))
        .ToArray();

    if (!actualIds.SequenceEqual(test.ExpectedIds))
    {
        throw new InvalidOperationException(
            $"{test.Name}: {test.Expression}{Environment.NewLine}" +
            $"Expected [{string.Join(", ", test.ExpectedIds)}], " +
            $"got [{string.Join(", ", actualIds.Select(id => id ?? "(missing id)"))}].");
    }

    Console.WriteLine($"Passed: {test.Name}");
}

Console.WriteLine($"Passed {suite.Cases.Length} XPath runtime cases.");

internal sealed record TestSuite(string Xml, TestCase[] Cases);
internal sealed record TestCase(string Name, string Expression, string[] ExpectedIds);
