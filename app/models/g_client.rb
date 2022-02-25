
require 'google/apis/customsearch_v1'

API_KEY = 'AIzaSyC_qyrPxPdX87e0RQic_G0Vp5quwDUcpPo'
CSE_ID = '77674c5dab935c6ec'

searcher = Google::Apis::CustomsearchV1::CustomsearchService.new
searcher.key = API_KEY

print "QUERY> "
query = gets.chomp

results = searcher.list_cses(query, cx: CSE_ID)
items = results.items
pp items.map {|item| { title: item.title, link: item.link} }
