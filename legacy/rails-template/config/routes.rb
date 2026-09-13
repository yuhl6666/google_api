Rails.application.routes.draw do
  get 'home/top'
  post "home/create" => "home#create"
  get "home/show" => "home#show"
  post "home/clear" => "home#clear"
  
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Defines the root path route ("/")
  # root "articles#index"
end
