class HomeController < ApplicationController

  def top
    
  end
  def show
    @cnt = Post.count
    @bnt = 0
    @pos = Post.last
    @pos = @pos.content
    @API_KEY = 'AIzaSyC_qyrPxPdX87e0RQic_G0Vp5quwDUcpPo'
    @CSE_ID = '77674c5dab935c6ec'
    @str = "v1?key=" + @API_KEY + "&cx=" + @CSE_ID + "&q=" + @pos
    @url =  File.join("https://www.googleapis.com/customsearch/", @str)

  end
  def new
  end
  def create
    @post = Post.new(content: params[:content])
    @post.save
    
    redirect_to("/home/show")
  end
  def clear
    @post = Post.all
    @post.destroy_all
    redirect_to("/home/show")
  end

end
